/*
 * prompt.js — ask from code, published as window.DzPrompt: in-page alert, confirm and prompt
 * dialogs (the prompt_dialog component) that return promises, in place of the browser's
 * alert(), confirm() and prompt().
 *
 *   await DzPrompt.alert('Settings saved');
 *   if (await DzPrompt.confirm({ title: 'Delete "Parks"?', message: 'This cannot be undone.',
 *                                tone: 'danger', confirmLabel: 'Delete' })) { ... }
 *   const name = await DzPrompt.prompt({ title: 'Rename page', inputLabel: 'Page name', value: 'Parks' });
 *   // name is the trimmed answer, or null when cancelled
 *
 * Each call takes a title string, or an object with prompt_dialog's options (title, message,
 * tone, confirmLabel, cancelLabel, inputLabel, inputType, value, placeholder, hint, required,
 * maxLength, confirmPhrase, labels). DzPrompt.open(options) is the general form: it resolves to
 * the result event's detail, { kind, confirmed, value, reason }.
 *
 * The dialog is created at the end of <body> while it is open and removed after it closes. Focus
 * returns to whatever had it before, so call these from the click or key handler that asks.
 *
 * Kept free of regex and backslash escapes on purpose (see global.js).
 */
const optionsOf = options => (options && typeof options === 'object' ? { ...options } : { title: String(options === undefined || options === null ? '' : options) });

const DzPrompt = {
    open(options) {
        const props = optionsOf(options);
        delete props.triggerLabel;
        delete props.open;
        return new Promise(resolve => {
            const el = document.createElement('dz-component');
            el.setAttribute('dz-type', 'prompt_dialog');
            el.setAttribute('data-dz-prompt', '');
            // Nothing of it shows in the page itself: the dialog renders in the top layer.
            el.style.cssText = 'position: fixed; left: 0; top: 0; width: 0; height: 0; overflow: hidden;';
            el._props = JSON.parse(JSON.stringify({ ...props, open: true }));
            el.addEventListener('result', event => {
                resolve(event.detail);
                // Removed once the closing animation has played.
                setTimeout(() => el.remove(), 400);
            }, { once: true });
            document.body.appendChild(el);
        });
    },

    // Resolves when it is dismissed.
    alert(options) {
        return DzPrompt.open({ ...optionsOf(options), kind: 'alert' }).then(() => undefined);
    },

    // Resolves true when confirmed, false when cancelled.
    confirm(options) {
        return DzPrompt.open({ ...optionsOf(options), kind: 'confirm' }).then(result => result.confirmed);
    },

    // Resolves to the trimmed answer, or null when cancelled. `value` is a shortcut for the
    // starting text when the first argument is just a title.
    prompt(options, value) {
        const props = { ...optionsOf(options), kind: 'prompt' };
        if (value !== undefined && props.value === undefined) props.value = String(value);
        return DzPrompt.open(props).then(result => (result.confirmed ? result.value : null));
    }
};

window.DzPrompt = DzPrompt;
export default DzPrompt;
