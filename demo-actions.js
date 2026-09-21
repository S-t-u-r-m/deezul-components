/*
 * demo-actions.js — what the gallery does with a demo's events, so the editable demos behave
 * the way they would in an app: the component emits, the page updates its own `items`.
 *
 * A catalog entry opts in with `actions: editableActions`. ComponentPage listens for every
 * event named here (plus each demo's menu events), writes a line to the demo's event log and
 * calls the matching handler with (detail, demo):
 *   demo.props        the demo's props as written in the catalog
 *   demo.items        the demo's current items
 *   demo.setItems(a)  push a new items array into the mounted demo and its props block
 * A handler may return a short note for the log, or a promise of one. The questions are asked
 * the way a host app would ask them: with DzPrompt (prompt.js), the in-page dialogs.
 */

const fieldsOf = props => ({
    labelKey: props.labelKey || 'label',
    childrenKey: props.childrenKey || 'children',
    idKey: props.idKey || 'id',
    orderKey: props.orderKey || 'order'
});

let counter = 0;
const newId = () => 'new-' + Date.now().toString(36) + '-' + (++counter);

// Replace the child array at `path` (a parent's index path; [] is the top level) with fn(copy),
// copying only what lies along the path.
function updateAt(list, path, childrenKey, fn) {
    if (!path.length) return fn(Array.isArray(list) ? list.slice() : []);
    const copy = list.slice();
    const [index, ...rest] = path;
    copy[index] = { ...copy[index], [childrenKey]: updateAt(copy[index][childrenKey], rest, childrenKey, fn) };
    return copy;
}

const label = (item, props) => String(item ? item[fieldsOf(props).labelKey] : '');

// Works for both lists: AccordionList details carry a `path`, DynamicList details an `index`.
export const editableActions = {
    select() {},

    async add(detail, demo) {
        const name = await window.DzPrompt.prompt({ title: 'Add an item', inputLabel: 'Name', confirmLabel: 'Add', maxLength: 80 });
        if (!name) return 'cancelled';
        const { labelKey, idKey, orderKey, childrenKey } = fieldsOf(demo.props);
        const item = { [idKey]: newId(), [labelKey]: name };
        if (detail.order !== null && detail.order !== undefined) item[orderKey] = detail.order;
        demo.setItems(Array.isArray(detail.path)
            ? updateAt(demo.items, detail.path, childrenKey, list => [...list, item])
            : [...demo.items, item]);
        window.DzToast.success('Added "' + name + '"');
        return 'added "' + name + '"';
    },

    async edit(detail, demo) {
        const before = label(detail.item, demo.props);
        const name = await window.DzPrompt.prompt({ title: 'Rename "' + before + '"', inputLabel: 'Name', value: before, confirmLabel: 'Rename', maxLength: 80 });
        if (!name || name === before) return 'unchanged';
        const { labelKey, childrenKey } = fieldsOf(demo.props);
        const rename = (list, at) => list.map((entry, i) => (i === at ? { ...entry, [labelKey]: name } : entry));
        demo.setItems(Array.isArray(detail.path)
            ? updateAt(demo.items, detail.path.slice(0, -1), childrenKey, list => rename(list, detail.path[detail.path.length - 1]))
            : rename(demo.items, detail.index));
        window.DzToast.success('Renamed to "' + name + '"');
        return 'renamed to "' + name + '"';
    },

    move(detail, demo) {
        demo.setItems(detail.items);
    },

    async delete(detail, demo) {
        const confirmed = await window.DzPrompt.confirm({ title: 'Delete "' + label(detail.item, demo.props) + '"?',
            message: 'Anything inside it is deleted too.', tone: 'danger', confirmLabel: 'Delete' });
        if (!confirmed) return 'kept';
        const before = demo.items;
        demo.setItems(detail.items);
        const after = JSON.stringify(demo.items);
        // Undo puts the list back, unless it has changed again since.
        window.DzToast.show({ message: 'Deleted "' + label(detail.item, demo.props) + '"', action: 'Undo' }).then(closed => {
            if (closed.reason !== 'action') return;
            if (JSON.stringify(demo.items) !== after) {
                window.DzToast.error('Couldn’t undo: the list has changed since.');
                return;
            }
            demo.setItems(before);
            window.DzToast.success('Restored');
        });
    }
};

// For toast_region demos showing their own `items`: a closed toast is removed from the list.
export const toastActions = {
    close(detail, demo) {
        demo.setItems(demo.items.filter((toast, index) => (toast.id || 'item-' + index) !== detail.id));
    }
};
