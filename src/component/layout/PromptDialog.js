export default Deezul.Component({
    // PromptDialog — the common questions a page asks, as a modal_dialog: alert (a message and
    // OK), confirm (Cancel and a confirm button, optionally "type DELETE to confirm"), and prompt
    // (one field with its label, hint and error). The in-page stand-in for the browser's alert(),
    // confirm() and prompt(), in the site's own look, with proper labels and focus.
    //
    // Two ways to use it:
    //
    //   From code (prompt.js, window.DzPrompt) — no markup; each returns a promise:
    //     if (await DzPrompt.confirm({ title: 'Delete this page?', tone: 'danger', confirmLabel: 'Delete' })) ...
    //     const name = await DzPrompt.prompt({ title: 'Rename page', inputLabel: 'Page name', value: 'Parks' });
    //     await DzPrompt.alert({ title: 'Settings saved', message: 'Your changes are live.' });
    //
    //   As a block — its own button (`triggerLabel`), or opened by the page with `open`:
    //     <dz-component dz-type="prompt_dialog" :triggerLabel="'Delete listing'" :kind="'confirm'"
    //                   :title="'Delete this listing?'" :tone="'danger'" @result="onDelete"></dz-component>
    //
    // KINDS:
    //   alert     the message and one button. Escape closes it too.
    //   confirm   Cancel and the confirm button. With confirmPhrase, a field where the visitor types
    //             the phrase (e.g. DELETE) before confirming goes through.
    //   prompt    a text field (or email, number, url, tel, textarea) with a label and hint.
    //             Enter submits (not in a textarea). Blank when required, a wrong email, number or
    //             web address, or too long shows an error beside the field and keeps it open.
    //
    // ACCESSIBILITY: role alertdialog, named by the title and described by the message, so both
    // are read out on opening. Focus starts on the field, on Cancel for a danger confirm (so Enter
    // can't destroy anything), otherwise on the confirm button; it returns where it was on closing.
    // Clicking outside does not close it: the visitor answers, or presses Escape to cancel.
    //
    // OPTIONS:
    //   kind           'confirm' (default), 'alert' or 'prompt'
    //   title          the question or headline, and the dialog's name: 'Delete this listing?'
    //   message        a sentence or two under it (blank = none)
    //   tone           'default', or 'danger' for something that can't be undone (red confirm button)
    //   confirmLabel   the confirm button (blank = 'OK' for alert and prompt, 'Confirm' for confirm);
    //                  say what it does: 'Delete listing'
    //   cancelLabel    the cancel button (blank = 'Cancel')
    //   inputLabel     prompt: the field's label (blank = the title)
    //   inputType      prompt: 'text' (default), 'email', 'number', 'url', 'tel' or 'textarea'
    //   value          prompt: what the field starts with (its text is selected, ready to replace)
    //   placeholder    prompt: an example inside the field — never instead of the label
    //   hint           prompt: help under the label, 'Shown in menus and the browser tab.'
    //   required       prompt: a blank answer is an error (default true)
    //   maxLength      prompt: most characters (default 0 = no limit)
    //   confirmPhrase  confirm: text to type before confirming, 'DELETE' (blank = none)
    //   triggerLabel   text of a button that opens it (blank = none; the page or DzPrompt opens it)
    //   open           open state, for a page controlling it (default false)
    //   headingLevel   level of the title (default 2)
    //   labels         text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   result   { kind, confirmed, value, reason }   when it closes. confirmed: the confirm button
    //            went through. value: the prompt's answer, trimmed ('' otherwise). reason:
    //            'confirm', 'cancel' or 'escape'. A page using `open` sets it back to false here.
    //
    // NEEDS: window.DzGlobal (global.js), imported by main.js, and the modal_dialog component.
    schema: {
        inputs: {
            kind:          { type: 'enum', options: ['confirm', 'alert', 'prompt'], default: 'confirm', label: 'Kind' },
            title:         { type: 'string', default: '', label: 'Title (the question)' },
            message:       { type: 'string', default: '', label: 'Message' },
            tone:          { type: 'enum', options: ['default', 'danger'], default: 'default', label: 'Tone' },
            confirmLabel:  { type: 'string', default: '', label: 'Confirm button (blank = OK or Confirm)' },
            cancelLabel:   { type: 'string', default: '', label: 'Cancel button (blank = Cancel)' },
            inputLabel:    { type: 'string', default: '', label: 'Field label (prompt)' },
            inputType:     { type: 'enum', options: ['text', 'email', 'number', 'url', 'tel', 'textarea'], default: 'text', label: 'Field type (prompt)' },
            value:         { type: 'string', default: '', label: 'Starting value (prompt)' },
            placeholder:   { type: 'string', default: '', label: 'Placeholder (prompt)' },
            hint:          { type: 'string', default: '', label: 'Hint (prompt)' },
            required:      { type: 'boolean', default: true, label: 'Required (prompt)' },
            maxLength:     { type: 'number', default: 0, label: 'Most characters (prompt; 0 = no limit)' },
            confirmPhrase: { type: 'string', default: '', label: 'Type to confirm (confirm; blank = none)' },
            triggerLabel:  { type: 'string', default: '', label: 'Button text (blank = opened by the page)' },
            open:          { type: 'boolean', default: false, label: 'Open' },
            headingLevel:  { type: 'number', default: 2, label: 'Title heading level' },
            labels:        { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. The form and buttons are this component's own
    // elements, slotted into modal_dialog: its body and footer. data-modal-focus picks what gets
    // focus when it opens.
    template: html`
    <div class="pd" ref="root">
        <dz-component dz-type="modal_dialog" :open="open" :triggerLabel="triggerLabel" :title="titleText" :label="ui.dialog"
                      :description="message" :role="'alertdialog'" :size="'small'" :showClose="false" :closeOnBackdrop="false"
                      :headingLevel="headingLevel" @open="onOpen($event)" @close="onClose($event)">
            <form class="pd-form" :if="hasInput" novalidate @submit="onSubmit($event)">
                <label class="pd-label" for="pd-input">{{ fieldLabel }}</label>
                <p class="pd-hint" id="pd-hint" :if="hintText">{{ hintText }}</p>
                <p class="pd-error" id="pd-error" :if="error"><span class="pd-sr">{{ ui.errorPrefix }}</span>{{ error }}</p>
                <input class="pd-input" id="pd-input" :if="!isTextarea" :type="fieldType" :placeholder="placeholder" :maxlength="maxAttr"
                       :aria-invalid="error ? 'true' : 'false'" :aria-describedby="describedBy" autocomplete="off"
                       data-modal-focus="true" @input="onInput($event)">
                <textarea class="pd-input is-textarea" id="pd-input" :if="isTextarea" rows="4" :placeholder="placeholder" :maxlength="maxAttr"
                          :aria-invalid="error ? 'true' : 'false'" :aria-describedby="describedBy"
                          data-modal-focus="true" @input="onInput($event)"></textarea>
            </form>
            <button type="button" slot="footer" class="pd-btn pd-cancel" :if="kind !== 'alert'"
                    :data-modal-focus="focusCancel ? 'true' : 'false'" @click="cancel()">{{ cancelText }}</button>
            <button type="button" slot="footer" class="pd-btn pd-confirm" :class="tone === 'danger' ? 'is-danger' : 'is-primary'"
                    :data-modal-focus="focusCancel || hasInput ? 'false' : 'true'" @click="confirm($event)">{{ confirmText }}</button>
        </dz-component>
    </div>
    `,

    data: () => ({
        kind: 'confirm', title: '', message: '', tone: 'default', confirmLabel: '', cancelLabel: '', inputLabel: '',
        inputType: 'text', value: '', placeholder: '', hint: '', required: true, maxLength: 0, confirmPhrase: '',
        triggerLabel: '', open: false, headingLevel: 2, labels: {},
        draft: '', error: '', outcome: null
    }),

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                dialog: 'Question',
                ok: 'OK',
                confirm: 'Confirm',
                cancel: 'Cancel',
                answer: 'Your answer',
                errorPrefix: 'Error: ',
                required: '{label} is required.',
                tooLong: '{label} can be at most {max} characters.',
                email: 'Enter an email address, like name@example.gov.',
                number: 'Enter a number.',
                url: 'Enter a full web address, starting with https://.',
                phraseLabel: 'Type {phrase} to confirm',
                phraseError: 'Type {phrase} exactly as shown to confirm.'
            }, this.labels);
        },

        titleText() {
            return DzGlobal.text(this.title).trim();
        },

        phrase() {
            return this.kind === 'confirm' ? DzGlobal.text(this.confirmPhrase).trim() : '';
        },

        hasInput() {
            return this.kind === 'prompt' || !!this.phrase;
        },

        isTextarea() {
            return this.kind === 'prompt' && this.inputType === 'textarea';
        },

        fieldType() {
            return this.kind === 'prompt' && ['email', 'number', 'url', 'tel'].includes(this.inputType) ? this.inputType : 'text';
        },

        fieldLabel() {
            if (this.phrase) return DzGlobal.format(this.ui.phraseLabel, { phrase: this.phrase });
            return DzGlobal.text(this.inputLabel).trim() || this.titleText || this.ui.answer;
        },

        hintText() {
            return this.phrase ? '' : DzGlobal.text(this.hint).trim();
        },

        maxChars() {
            const n = Math.floor(Number(this.maxLength));
            return this.kind === 'prompt' && n > 0 ? n : 0;
        },

        // No limit is the attribute's own maximum, so the binding never renders a blank value.
        maxAttr() {
            return this.maxChars || 524288;
        },

        describedBy() {
            return [this.hintText ? 'pd-hint' : '', this.error ? 'pd-error' : ''].filter(Boolean).join(' ');
        },

        // A danger confirm starts on Cancel: Enter or Space right away must not destroy anything.
        focusCancel() {
            return this.kind === 'confirm' && this.tone === 'danger' && !this.hasInput;
        },

        confirmText() {
            const own = DzGlobal.text(this.confirmLabel).trim();
            return own || (this.kind === 'confirm' ? this.ui.confirm : this.ui.ok);
        },

        cancelText() {
            return DzGlobal.text(this.cancelLabel).trim() || this.ui.cancel;
        }
    },

    methods: {
        field(root) {
            return root ? root.querySelector('#pd-input') : null;
        },

        // Opened (by the page, DzPrompt or the trigger): start from `value`, with its text selected.
        onOpen(event) {
            this.open = true;
            this.outcome = null;
            this.error = '';
            const start = this.kind === 'prompt' ? DzGlobal.text(this.value) : '';
            this.draft = start;
            const input = this.field(event.target.getRootNode());
            if (!input) return;
            input.value = start;
            if (start && typeof input.select === 'function') input.select();
        },

        onInput(event) {
            this.draft = event.target.value;
            if (this.error) this.error = '';
        },

        onSubmit(event) {
            event.preventDefault();
            this.confirm(event);
        },

        // The error for the answer as typed, or '' when it can go through.
        problem(input) {
            const ui = this.ui;
            const text = DzGlobal.text(this.draft).trim();
            const label = this.fieldLabel;
            if (this.phrase) return text === this.phrase ? '' : DzGlobal.format(ui.phraseError, { phrase: this.phrase });
            const validity = input && input.validity;
            if (validity && validity.badInput) return ui.number;
            if (!text) return this.required ? DzGlobal.format(ui.required, { label }) : '';
            if (this.maxChars && text.length > this.maxChars) return DzGlobal.format(ui.tooLong, { label, max: this.maxChars });
            if (validity && validity.typeMismatch) return this.fieldType === 'email' ? ui.email : this.fieldType === 'url' ? ui.url : '';
            return '';
        },

        async confirm(event) {
            if (this.hasInput) {
                const input = this.field(event.target.getRootNode());
                const problem = this.problem(input);
                if (problem) {
                    this.error = problem;
                    const deezul = window.Deezul;
                    if (deezul && typeof deezul.nextTick === 'function') await deezul.nextTick();
                    if (input) input.focus();
                    return;
                }
            }
            this.outcome = { confirmed: true, reason: 'confirm' };
            this.open = false;
        },

        cancel() {
            this.outcome = { confirmed: false, reason: 'cancel' };
            this.open = false;
        },

        // Every way of closing ends here: the buttons (through `open`), and Escape.
        onClose() {
            const outcome = this.outcome || { confirmed: false, reason: 'escape' };
            const value = outcome.confirmed && this.kind === 'prompt' ? DzGlobal.text(this.draft).trim() : '';
            this.outcome = null;
            this.open = false;
            this.error = '';
            this.$emit('result', { kind: this.kind, confirmed: outcome.confirmed, value, reason: outcome.reason });
        }
    },

    styles: /*css*/ `
        :host { display: contents; }

        .pd-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
                 clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

        /* ---- The field. Borders are 3.4:1 against white (WCAG 1.4.11 wants 3:1). */
        /* No margin here: modal_dialog spaces it from the message (styles set here would win). */
        .pd-form { display: flex; flex-direction: column; font-family: var(--dz-font-body, inherit); }
        .pd-label { font-size: .9375rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .pd-hint { margin: .2rem 0 0; font-size: .875rem; line-height: 1.45; color: #555b69; }
        .pd-error { display: flex; align-items: center; gap: .4rem; margin: .35rem 0 0; font-size: .875rem; font-weight: 700; color: #b42318; }
        .pd-error::before { content: "!" / ""; display: inline-flex; flex: none; align-items: center; justify-content: center;
                            width: 1.1rem; height: 1.1rem; border-radius: 50%; background: #b42318; color: #fff; font-size: .75rem; }
        .pd-input { box-sizing: border-box; width: 100%; min-height: 2.75rem; margin-top: .45rem; padding: .55rem .75rem;
                    border: 1px solid #8a8f9c; border-radius: 8px; background: var(--dz-color-surface, #fff);
                    font: inherit; font-size: 1rem; color: var(--dz-color-heading, #1f2330); }
        .pd-input.is-textarea { min-height: 6.5rem; resize: vertical; line-height: 1.5; }
        .pd-input:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 1px; border-color: var(--dz-color-primary, #5b5ef0); }
        .pd-input[aria-invalid="true"] { border: 2px solid #b42318; }

        /* ---- Buttons: 44px targets. White on #4a4dd6 is 6.1:1, on #b42318 6.5:1. */
        .pd-btn { box-sizing: border-box; min-height: 2.75rem; padding: 0 1.15rem; border: 1px solid transparent; border-radius: 999px;
                  font-family: var(--dz-font-body, inherit); font-size: .9375rem; font-weight: 650; cursor: pointer;
                  transition: background-color .15s ease, border-color .15s ease; }
        .pd-btn:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 3px; }
        .pd-cancel { border-color: #8a8f9c; background: var(--dz-color-surface, #fff); color: var(--dz-color-heading, #1f2330); }
        .pd-cancel:hover { background: var(--dz-color-bg, #f3f4f8); }
        .pd-confirm.is-primary { background: #4a4dd6; color: #fff; }
        .pd-confirm.is-primary:hover { background: #3b3ec2; }
        .pd-confirm.is-danger { background: #b42318; color: #fff; }
        .pd-confirm.is-danger:hover { background: #912018; }
        .pd-confirm.is-danger:focus-visible { outline-color: #b42318; }

        /* Phones: the buttons share the width, the confirm button on top. */
        @media (max-width: 640px) {
            .pd-btn { flex: 1 1 100%; }
            .pd-confirm { order: -1; }
        }
    `
});
