export default Deezul.Component({
    // PageFeedback — "Was this page helpful?" at the foot of a page: Yes, No, and a thank-you.
    // Saying No (or either answer, with `askComment` 'always') opens the prompt dialog for a note,
    // so there is no second form on the page and nothing to fill in by accident.
    //
    //   <dz-component dz-type="page_feedback" :page="'/departments/health'" @feedback="record"></dz-component>
    //
    // The component only asks; the CMS stores the answers. It emits `feedback` the moment a button
    // is pressed, and `comment` if a note follows — so a visitor who closes the note dialog still
    // counts as a vote.
    //
    // ACCESSIBILITY: the question is a plain paragraph naming the two buttons, so a screen reader
    // reads "Was this page helpful? Yes" on the button. Answering replaces the buttons with the
    // thank-you, which is announced (role status) and takes focus, since the button it was on has
    // gone. Buttons are 44px.
    //
    // OPTIONS:
    //   question      the question (default 'Was this page helpful?')
    //   page          what is being rated, sent with the events: a path, an id (blank = the
    //                 address of the page)
    //   askComment    when to ask for a note: 'negative' (default: after No), 'always' or 'never'
    //   commentTitle  the note dialog's title (blank = a sensible one for the answer)
    //   commentLabel  the note field's label
    //   commentHint   help under the label
    //   answered      show it already answered: 'yes', 'no' or blank; for the CMS editor and tests
    //   variant       'bar' (default: a tinted strip) or 'plain' (no background)
    //   headingLevel  makes the question a heading at this level (0 = not a heading, the default)
    //   labels        text overrides; see the `ui` computed for the keys
    //
    // EVENTS emitted:
    //   feedback   { helpful, page }            a button was pressed
    //   comment    { helpful, comment, page }   a note was written and sent
    //
    // NEEDS: window.DzGlobal (global.js) and, for notes, window.DzPrompt (prompt.js) and the
    // prompt_dialog component; without it the answer is taken and no note is asked for.
    schema: {
        inputs: {
            question:     { type: 'string', default: '', label: 'Question (blank = Was this page helpful?)' },
            page:         { type: 'string', default: '', label: 'Page being rated (blank = this address)' },
            askComment:   { type: 'enum', options: ['negative', 'always', 'never'], default: 'negative', label: 'Ask for a note' },
            commentTitle: { type: 'string', default: '', label: 'Note dialog title' },
            commentLabel: { type: 'string', default: '', label: 'Note field label' },
            commentHint:  { type: 'string', default: '', label: 'Note hint' },
            answered:     { type: 'enum', options: ['', 'yes', 'no'], default: '', label: 'Show as already answered' },
            variant:      { type: 'enum', options: ['bar', 'plain'], default: 'bar', label: 'Style' },
            headingLevel: { type: 'number', default: 0, label: 'Question heading level (0 = not a heading)' },
            labels:       { type: 'object', default: {}, label: 'Text overrides' }
        }
    },

    // `ref` only on the outermost element. The question and the thank-you swap places; the
    // thank-you can take focus, because the button that had it is gone.
    template: html`
    <div class="pf" ref="root" :class="rootClass">
        <div class="pf-ask" :if="!answer">
            <p class="pf-question" id="pf-question" :if="!level">{{ questionText }}</p>
            <p class="pf-question" id="pf-question" :if="level" role="heading" :aria-level="level">{{ questionText }}</p>
            <div class="pf-buttons">
                <button type="button" class="pf-button" aria-describedby="pf-question" @click="answerWith(true)">{{ ui.yes }}</button>
                <button type="button" class="pf-button" aria-describedby="pf-question" @click="answerWith(false)">{{ ui.no }}</button>
            </div>
        </div>
        <p class="pf-thanks" :if="answer" role="status" tabindex="-1">{{ thanksText }}</p>
    </div>
    `,

    data: () => ({
        question: '', page: '', askComment: 'negative', commentTitle: '', commentLabel: '', commentHint: '',
        answered: '', variant: 'bar', headingLevel: 0, labels: {},
        answer: '', noted: false
    }),

    // A host previewing an answered state (the CMS editor) sets `answered`.
    $mounted() {
        this.applyAnswered();
    },

    $updated() {
        this.applyAnswered();
    },

    computed: {
        // Every string the component shows or announces, with the host's `labels` overrides.
        ui() {
            return DzGlobal.labels({
                question: 'Was this page helpful?',
                yes: 'Yes',
                no: 'No',
                thanks: 'Thanks for your feedback.',
                thanksNote: 'Thanks — your note has been sent.',
                noteTitleYes: 'What did you find useful?',
                noteTitleNo: 'What went wrong?',
                noteLabel: 'Your note',
                noteHint: 'Optional. Please do not include personal details.',
                send: 'Send',
                cancel: 'No thanks'
            }, this.labels);
        },

        rootClass() {
            return 'is-' + (this.variant === 'plain' ? 'plain' : 'bar');
        },

        questionText() {
            return DzGlobal.text(this.question).trim() || this.ui.question;
        },

        level() {
            const n = Math.round(Number(this.headingLevel));
            return n >= 1 && n <= 6 ? n : 0;
        },

        thanksText() {
            return this.noted ? this.ui.thanksNote : this.ui.thanks;
        },

        pageId() {
            const own = DzGlobal.text(this.page).trim();
            if (own) return own;
            return typeof window === 'undefined' ? '' : window.location.pathname + window.location.search;
        }
    },

    methods: {
        applyAnswered() {
            const wanted = ['yes', 'no'].includes(this.answered) ? this.answered : '';
            if (wanted && this.answer !== wanted) this.answer = wanted;
        },

        // A button was pressed: the vote goes out at once, then the note is asked for, so closing
        // the note dialog still leaves the vote recorded.
        async answerWith(helpful) {
            if (this.answer) return;
            this.answer = helpful ? 'yes' : 'no';
            this.noted = false;
            this.$emit('feedback', { helpful, page: this.pageId });
            await DzGlobal.focusIn(DzGlobal.raw(this.$refs.root), '.pf-thanks');
            const note = await this.askNote(helpful);
            if (!note) return;
            this.noted = true;
            this.$emit('comment', { helpful, comment: note, page: this.pageId });
        },

        // The note, through the prompt dialog, or '' when it isn't asked for or is left empty.
        async askNote(helpful) {
            const wanted = this.askComment === 'always' || (this.askComment !== 'never' && !helpful);
            const prompt = window.DzPrompt;
            if (!wanted || !prompt) return '';
            const ui = this.ui;
            const note = await prompt.prompt({
                title: DzGlobal.text(this.commentTitle).trim() || (helpful ? ui.noteTitleYes : ui.noteTitleNo),
                inputType: 'textarea',
                inputLabel: DzGlobal.text(this.commentLabel).trim() || ui.noteLabel,
                hint: DzGlobal.text(this.commentHint).trim() || ui.noteHint,
                required: false,
                maxLength: 1000,
                confirmLabel: ui.send,
                cancelLabel: ui.cancel
            });
            return DzGlobal.text(note).trim();
        }
    },

    styles: /*css*/ `
        :host { display: block; }

        .pf { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1.25rem; box-sizing: border-box;
              font-family: var(--dz-font-body, inherit); color: var(--dz-color-text, #2b2f3a); }
        .is-bar { padding: 1.1rem 1.25rem; border: 1px solid var(--dz-color-border, #e4e6ee); border-radius: 12px;
                  background: var(--dz-color-bg, #f3f4f8); }

        .pf-ask { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1.25rem; }
        .pf-question { margin: 0; font-size: 1rem; font-weight: 700; color: var(--dz-color-heading, #1f2330); }
        .pf-buttons { display: flex; gap: .6rem; }

        /* 44px targets; the border is 3.4:1 against the strip (WCAG 1.4.11 wants 3:1). */
        .pf-button { min-width: 5.5rem; min-height: 2.75rem; padding: 0 1.25rem; border: 1px solid #8a8f9c; border-radius: 999px;
                     background: var(--dz-color-surface, #fff); font: inherit; font-size: .9375rem; font-weight: 650;
                     color: var(--dz-color-heading, #1f2330); cursor: pointer;
                     transition: background-color .15s ease, border-color .15s ease; }
        .pf-button:hover { border-color: #4a4dd6; background: #eef0ff; color: #3b3ec2; }
        .pf-button:focus-visible { outline: 2px solid var(--dz-color-primary, #5b5ef0); outline-offset: 3px; }

        /* The thank-you takes focus without showing a focus ring: it isn't a control. */
        .pf-thanks { margin: 0; font-size: 1rem; font-weight: 650; color: var(--dz-color-heading, #1f2330); }
        .pf-thanks:focus { outline: none; }

        @media (max-width: 480px) {
            .pf-ask { flex-direction: column; align-items: flex-start; }
            .pf-buttons { width: 100%; }
            .pf-button { flex: 1; }
        }
    `
});
