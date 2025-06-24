// Wait for the DOM to be fully loaded before running the app
document.addEventListener('DOMContentLoaded', () => {

    class SynapseApp {
        constructor() {
            this.curriculum = this._getCurriculumData();
            this.state = {
                currentUnit: null,
                currentLessonIndex: 0,
                completedLessons: new Set(),
                activeHtmlContent: {},
                splitInstance: null,
                challengeEditor: null,
                GutterSize: 5,
                NumPanels: 3,
                codexCollapseThreshold: 150,
                codexExpandThreshold: 70,
                isTogglingCollapse: false
            };
            this._cacheDOMElements();
            this.quizApp = this._initializeQuizApp();
        }

        _cacheDOMElements() {
            this.dom = {
                body: document.body,
                panelsContainer: document.getElementById('panels-container'),
                mainMenu: document.getElementById("main-menu"),
                learnView: document.getElementById("learn-view"),
                quizPageContainer: document.getElementById("quiz-page-container"),
                unitTitleHeader: document.getElementById("unit-title-header"),
                lessonList: document.getElementById("lesson-list"),
                progressBarFg: document.getElementById("progress-bar-fg"),
                progressPercentage: document.getElementById("progress-percentage"),
                lessonTitle: document.getElementById("lesson-title"),
                lessonInsight: document.getElementById("lesson-insight"),
                commandButtons: document.getElementById("command-buttons"),
                lessonChallengeArea: document.getElementById("lesson-challenge-area"),
                cssPlayground: document.getElementById("css-playground"),
                visualBox: document.getElementById("visual-box"),
                htmlSandbox: document.getElementById("html-sandbox"),
                navbarTitle: document.getElementById("navbar-title"),
                homeLink: document.getElementById("home-link"),
                panels: {
                    codex: document.getElementById("codex-panel"),
                    insight: document.getElementById("insight-panel"),
                    playground: document.getElementById("playground-panel")
                },
                tabs: {
                    insight: document.getElementById('tab-insight'),
                    challenge: document.getElementById('tab-challenge')
                },
                tabContents: {
                    insight: document.getElementById('insight-content-tab'),
                    challenge: document.getElementById('challenge-content-tab')
                },
                buttons: {
                    goToChallenge: document.getElementById('go-to-challenge-btn'),
                    collapseCodex: document.getElementById('collapse-codex'),
                    startQuiz: document.getElementById('start-quiz-btn'),
                    settings: document.getElementById('settings-btn'),
                },
                settingsDropdown: document.getElementById('settings-dropdown'),
                themeButtons: document.querySelectorAll('[data-theme]'),
                unitCardButtons: document.querySelectorAll('.unit-card[data-unit-key]'),
                resetProgressButtons: document.querySelectorAll('.reset-progress-btn'),
            };
        }

        init() {
            this._loadTheme();
            this._bindEvents();
            this._handleResize();
        }

        _bindEvents() {
            window.addEventListener("resize", () => this._handleResize());
            document.addEventListener('keydown', (e) => this._handleKeyboardShortcuts(e));
            this.dom.homeLink.addEventListener("click", (e) => {
                e.preventDefault();
                this._showView('mainMenu');
            });
            this.dom.unitCardButtons.forEach(button => button.addEventListener('click', (e) => this.selectUnit(e.currentTarget.dataset.unitKey)));
            this.dom.resetProgressButtons.forEach(button => button.addEventListener('click', (e) => {
                e.stopPropagation();
                const unitKey = e.currentTarget.dataset.unitKey;
                if (confirm(`您確定要重設「${this.curriculum[unitKey].title}」的所有學習進度嗎？此操作無法復原。`)) {
                    localStorage.removeItem(`progress_${unitKey}`);
                    alert(`「${this.curriculum[unitKey].title}」的進度已成功重設。`);
                }
            }));
            this.dom.tabs.insight.addEventListener('click', () => this._switchTab('insight'));
            this.dom.tabs.challenge.addEventListener('click', () => this._switchTab('challenge'));
            this.dom.buttons.goToChallenge.addEventListener('click', () => this._switchTab('challenge'));
            this.dom.buttons.collapseCodex.addEventListener("click", () => this._togglePanelCollapse('codex'));
            this.dom.buttons.startQuiz.addEventListener('click', () => this.selectQuiz());
            this.dom.buttons.settings.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dom.settingsDropdown.classList.toggle('hidden');
            });
            document.addEventListener('click', () => this.dom.settingsDropdown.classList.add('hidden'));
            this.dom.settingsDropdown.addEventListener('click', (e) => e.stopPropagation());
            this.dom.themeButtons.forEach(button => button.addEventListener('click', (e) => {
                this._setTheme(e.currentTarget.dataset.theme);
            }));
        }

        _handleKeyboardShortcuts(e) {
            // Toggle between insight and challenge tabs
            if (e.altKey && e.key.toLowerCase() === 'q') {
                if (this.dom.learnView.classList.contains('is-active')) {
                    e.preventDefault();
                    const currentActive = this.dom.tabs.insight.classList.contains('active') ? 'insight' : 'challenge';
                    this._switchTab(currentActive === 'insight' ? 'challenge' : 'insight');
                }
            }

            // *** DEVELOPER MODE: AUTO-PASS CHALLENGE ***
            if (e.altKey && e.key === '`') {
                if (this.dom.learnView.classList.contains('is-active') && this.dom.tabs.challenge.classList.contains('active')) {
                    e.preventDefault();
                    this._passChallenge();
                }
            }
        }

        _passChallenge() {
            if (!this.state.challengeEditor) return;

            const editor = this.state.challengeEditor;
            const editorWrapper = editor.getWrapperElement();
            const feedbackEl = document.getElementById("challenge-feedback");

            console.warn("Developer Mode: Challenge passed.");

            editorWrapper.classList.remove("error");
            editorWrapper.classList.add("success");
            editor.setOption("readOnly", true);
            feedbackEl.textContent = "開發者模式：挑戰通過！";
            feedbackEl.style.color = "var(--success-color)";

            this.state.completedLessons.add(this.state.currentLessonIndex);
            localStorage.setItem(`progress_${this.state.currentUnit}`, JSON.stringify(Array.from(this.state.completedLessons)));

            setTimeout(() => {
                this._renderLessonList();
                this._renderChallengeArea();
            }, 1000);
        }

        _loadTheme() {
            const savedTheme = localStorage.getItem('synapse-theme') || 'system';
            this._setTheme(savedTheme);
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (localStorage.getItem('synapse-theme') === 'system') {
                    this._applySystemTheme();
                }
            });
        }

        _applySystemTheme() {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.dom.body.dataset.theme = isDark ? 'dark' : 'light';
            this._updateEditorThemes();
        }

        _setTheme(themeName) {
            localStorage.setItem('synapse-theme', themeName);
            this.dom.themeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === themeName));
            if (themeName === 'system') {
                this._applySystemTheme();
            } else {
                this.dom.body.dataset.theme = themeName;
                this._updateEditorThemes();
            }
        }

        _updateEditorThemes() {
            if (!window.CodeMirror) return;
            const currentBodyTheme = this.dom.body.dataset.theme;
            const editorTheme = currentBodyTheme === 'light' ? 'neat' : 'material-darker';
            if (this.state.challengeEditor) {
                this.state.challengeEditor.setOption('theme', editorTheme);
            }
            if (this.quizApp && this.quizApp.getCurrentEditor()) {
                this.quizApp.getCurrentEditor().setOption('theme', editorTheme);
            }
        }

        _showView(viewName) {
            Object.values(this.dom).filter(el => el && el.classList && el.classList.contains('view')).forEach(v => v.classList.remove('is-active'));
            this.dom[viewName].classList.add('is-active');
            if (viewName === 'mainMenu' && this.state.splitInstance) {
                this._destroyDesktopLayout();
            }
        }

        selectUnit(unitKey) {
            this.dom.panels.codex.classList.remove('is-collapsed');
            this.dom.buttons.collapseCodex.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" /></svg>`;

            this.state.currentUnit = unitKey;

            this.dom.cssPlayground.classList.toggle("hidden", unitKey !== 'CSS');
            this.dom.htmlSandbox.classList.toggle("hidden", unitKey !== 'HTML');

            const progress = localStorage.getItem(`progress_${unitKey}`);
            this.state.completedLessons = progress ? new Set(JSON.parse(progress).map(Number)) : new Set();
            const totalLessons = this.curriculum[unitKey].lessons.length;
            this.state.currentLessonIndex = this.state.completedLessons.size >= totalLessons ? 0 : this.state.completedLessons.size;

            this.dom.navbarTitle.textContent = this.curriculum[unitKey].title;
            this._showView('learnView');
            this._handleResize();
            this.selectLesson(this.state.currentLessonIndex);
        }

        selectQuiz() {
            this._showView('quizPageContainer');
            this.quizApp.start();
        }

        selectLesson(index) {
            if (!this.state.currentUnit) return;
            const unit = this.curriculum[this.state.currentUnit];
            if (index > this.state.completedLessons.size && index < unit.lessons.length) return;
            this.state.currentLessonIndex = index;
            this._renderLesson();
        }

        _togglePanelCollapse(panelKey, forceState) {
            if (this.state.isTogglingCollapse) return;
            this.state.isTogglingCollapse = true;
            this.dom.panelsContainer.classList.add('no-pointer-events');

            const panel = this.dom.panels[panelKey];
            const button = this.dom.buttons.collapseCodex;
            if (!this.state.splitInstance) return;

            const isCollapsed = panel.classList.contains("is-collapsed");
            const shouldCollapse = forceState === 'collapse' || (forceState !== 'expand' && !isCollapsed);

            if (shouldCollapse) {
                panel.classList.add("is-collapsed");
                const currentSizes = this.state.splitInstance.getSizes();
                const minSizePx = 40;
                const containerWidth = this.dom.panelsContainer.clientWidth - (this.state.GutterSize * (this.state.NumPanels - 1));
                const minSizePercent = (minSizePx / containerWidth) * 100;
                const sizeToDistribute = currentSizes[0] - minSizePercent;
                this.state.splitInstance.setSizes([minSizePercent, currentSizes[1] + sizeToDistribute, currentSizes[2]]);
                button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" /></svg>`;
            } else {
                panel.classList.remove("is-collapsed");
                this.state.splitInstance.setSizes([25, 50, 25]);
                button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" /></svg>`;
            }
            setTimeout(() => {
                this.dom.panelsContainer.classList.remove('no-pointer-events');
                this.state.isTogglingCollapse = false;
            }, 400);
        }

        _setupDesktopLayout() {
            if (window.innerWidth < 769 || this.state.splitInstance) return;
            this.state.splitInstance = Split(['#codex-panel', '#insight-panel', '#playground-panel'], {
                sizes: [25, 50, 25],
                minSize: [40, 200, 200],
                gutterSize: this.state.GutterSize,
                snapOffset: 30,
                onDrag: (sizes) => {
                    if (this.state.isTogglingCollapse) return;
                    const codexPanel = this.dom.panels.codex;
                    const containerWidth = this.dom.panelsContainer.clientWidth;
                    const codexCurrentWidthPx = (sizes[0] / 100) * containerWidth;

                    if (!codexPanel.classList.contains('is-collapsed') && codexCurrentWidthPx < this.state.codexCollapseThreshold) {
                        this._togglePanelCollapse('codex', 'collapse');
                    }
                    else if (codexPanel.classList.contains('is-collapsed') && codexCurrentWidthPx > this.state.codexExpandThreshold) {
                        this._togglePanelCollapse('codex', 'expand');
                    }
                }
            });
        }

        _destroyDesktopLayout() {
            if (this.state.splitInstance) {
                this.state.splitInstance.destroy();
                this.state.splitInstance = null;
            }
            Object.values(this.dom.panels).forEach(panel => panel.style.width = "");
        }

        _renderChallengeArea() {
            this.dom.lessonChallengeArea.innerHTML = "";
            this.state.challengeEditor = null;
            const lesson = this.curriculum[this.state.currentUnit].lessons[this.state.currentLessonIndex];
            if (this.state.completedLessons.has(this.state.currentLessonIndex)) {
                const isLastLesson = this.state.currentLessonIndex >= this.curriculum[this.state.currentUnit].lessons.length - 1;
                const buttonHtml = isLastLesson ? `<button id="finish-btn" class="btn">完成所有課程！</button>` : `<button id="next-lesson-btn" class="btn shimmer">前往下一課 →</button>`;
                this.dom.lessonChallengeArea.innerHTML = `<p style="color: var(--success-color); font-weight: bold; text-align: center;">✓ 挑戰完成!</p>${buttonHtml}`;
                if (!isLastLesson) {
                    document.getElementById("next-lesson-btn").addEventListener('click', () => this.selectLesson(this.state.currentLessonIndex + 1));
                } else {
                    document.getElementById("finish-btn").addEventListener('click', () => this._showView('mainMenu'));
                }
                return;
            }
            const prompt = document.createElement('h4');
            prompt.innerHTML = lesson.challenge.prompt;
            const editorContainer = document.createElement('div');
            const feedback = document.createElement('div');
            feedback.id = 'challenge-feedback';
            this.dom.lessonChallengeArea.append(prompt, editorContainer, feedback);
            const editorMode = this.state.currentUnit === 'HTML' ? 'htmlmixed' : 'css';
            const currentTheme = this.dom.body.dataset.theme === 'light' ? 'neat' : 'material-darker';
            this.state.challengeEditor = CodeMirror(editorContainer, {
                value: '', mode: editorMode, theme: currentTheme,
                lineNumbers: true, autofocus: true, lineWrapping: true,
            });
            this.state.challengeEditor.on('change', () => {
                this._updateLivePreview();
                this._checkChallengeLive();
            });
            setTimeout(() => {
                this.state.challengeEditor.refresh();
                this._updateLivePreview();
            }, 1);
        }

        _updateLivePreview(forcedCode) {
            if (this.state.currentUnit !== 'HTML') return;
            const code = typeof forcedCode === 'string' ? forcedCode : (this.state.challengeEditor ? this.state.challengeEditor.getValue() : '');
            const sandbox = this.dom.htmlSandbox;
            try {
                const sandboxDoc = sandbox.contentWindow.document;
                sandboxDoc.open();
                sandboxDoc.write(code);
                sandboxDoc.close();
            } catch (e) {
                console.error("Error writing to iframe:", e);
            }
        }

        _checkChallengeLive() {
            if (!this.state.challengeEditor) return;
            const editor = this.state.challengeEditor;
            const editorWrapper = editor.getWrapperElement();
            const feedbackEl = document.getElementById("challenge-feedback");
            const lesson = this.curriculum[this.state.currentUnit].lessons[this.state.currentLessonIndex];
            const code = editor.getValue();

            let isCorrect = false;
            try {
                if (this.state.currentUnit === 'HTML') {
                    const sandboxDoc = this.dom.htmlSandbox.contentWindow.document;
                    isCorrect = lesson.challenge.validator(sandboxDoc);
                } else {
                    const tempBox = document.createElement('div');
                    if (lesson.title === 'Flexbox 佈局') {
                        tempBox.style.cssText = code;
                        isCorrect = lesson.challenge.validator(tempBox);
                    } else {
                        tempBox.style.cssText = code;
                        isCorrect = lesson.challenge.validator(tempBox);
                    }
                }
            } catch (error) { isCorrect = false; }

            if (isCorrect) {
                editorWrapper.classList.remove("error");
                editorWrapper.classList.add("success");
                editor.setOption("readOnly", true);
                feedbackEl.textContent = "太棒了，完全正確！";
                feedbackEl.style.color = "var(--success-color)";
                this.state.completedLessons.add(this.state.currentLessonIndex);
                localStorage.setItem(`progress_${this.state.currentUnit}`, JSON.stringify(Array.from(this.state.completedLessons)));

                if (this.state.currentUnit === 'CSS') {
                    let targetPlayground = lesson.title === 'Flexbox 佈局' ? this.dom.cssPlayground : this.dom.visualBox;
                    targetPlayground.style.cssText += code;
                }

                setTimeout(() => {
                    this._renderLessonList();
                    this._renderChallengeArea();
                }, 1000);
            } else {
                editorWrapper.classList.remove("success");
                if (code.trim().length > 2) {
                    editorWrapper.classList.add("error");
                    feedbackEl.textContent = lesson.challenge.hint;
                    feedbackEl.style.color = "var(--error-color)";
                } else {
                    editorWrapper.classList.remove("error");
                    feedbackEl.textContent = "";
                }
            }
        }

        _handleHtmlCommandClick(event) {
            const btn = event.currentTarget;
            const content = btn.dataset.content;
            const group = btn.dataset.group;
            const isActive = btn.classList.contains('active-command');
            const groupButtons = btn.parentElement.querySelectorAll('.command-btn');

            if (isActive) {
                btn.classList.remove('active-command');
                delete this.state.activeHtmlContent[group];
            } else {
                groupButtons.forEach(b => b.classList.remove('active-command'));
                btn.classList.add('active-command');
                this.state.activeHtmlContent[group] = content;
            }

            const lessonOrder = Object.keys(this.curriculum.HTML.lessons.reduce((acc, lesson) => {
                if (lesson.commands[0]?.group) { lesson.commands.forEach(cmd => acc[cmd.group] = true); }
                return acc;
            }, {}));

            const fullCode = lessonOrder
                .filter(key => this.state.activeHtmlContent[key])
                .map(key => this.state.activeHtmlContent[key])
                .join('\n\n');

            this._updateLivePreview(fullCode);
        }

        _switchTab(tabName) {
            const isInsight = tabName === 'insight';
            this.dom.tabs.insight.classList.toggle('active', isInsight);
            this.dom.tabs.challenge.classList.toggle('active', !isInsight);
            this.dom.tabContents.insight.classList.toggle('hidden', !isInsight);
            this.dom.tabContents.challenge.classList.toggle('hidden', isInsight);

            if (!isInsight && this.state.challengeEditor) {
                this.state.challengeEditor.focus();
                this.state.challengeEditor.refresh();
            }
        }

        // --- UNCHANGED HELPER METHODS (abbreviated for clarity) ---
        _handleResize() { if (window.innerWidth < 769) { this._destroyDesktopLayout(); } else { this._setupDesktopLayout(); } }
        _renderLessonList() { const unit = this.curriculum[this.state.currentUnit]; const totalLessons = unit.lessons.length; const completedCount = this.state.completedLessons.size; const percentage = totalLessons > 0 ? Math.round(completedCount / totalLessons * 100) : 0; this.dom.progressBarFg.style.width = `${percentage}%`; this.dom.progressPercentage.textContent = `${percentage}%`; this.dom.lessonList.innerHTML = ""; unit.lessons.forEach((lesson, index) => { const li = document.createElement("li"); li.className = "lesson-item"; li.innerHTML = `<div class="lesson-icon-container"><span>${index + 1}</span></div><span class="lesson-text">${lesson.title}</span>`; const isCompleted = this.state.completedLessons.has(index); const isLocked = !isCompleted && index > this.state.completedLessons.size; if (isCompleted) li.classList.add("completed"); if (isLocked) li.classList.add("locked"); if (index === this.state.currentLessonIndex) li.classList.add("active"); li.addEventListener('click', () => this.selectLesson(index)); this.dom.lessonList.appendChild(li); }); }
        _renderLesson() { this._resetPlaygrounds(); this._renderLessonList(); const lesson = this.curriculum[this.state.currentUnit].lessons[this.state.currentLessonIndex]; this.dom.lessonTitle.textContent = lesson.title; this.dom.lessonInsight.innerHTML = lesson.insight; this.dom.commandButtons.innerHTML = ""; const hasAction = lesson.commands[0]?.action; if (hasAction) { lesson.commands.forEach(cmd => { const btn = document.createElement("button"); btn.className = "command-btn"; btn.textContent = cmd.label; btn.setAttribute('aria-label', `範例: ${cmd.label}`); btn.addEventListener('click', (e) => { const isActive = e.currentTarget.classList.contains('active-command'); document.querySelectorAll('#command-buttons .command-btn').forEach(b => b.classList.remove('active-command')); this.dom.htmlSandbox.innerHTML = ''; this.dom.htmlSandbox.style.cssText = ''; if (!isActive) { e.currentTarget.classList.add('active-command'); cmd.action(this.dom.htmlSandbox); } }); this.dom.commandButtons.appendChild(btn); }); } else { let targetElement = this.state.currentUnit === 'HTML' ? this.dom.htmlSandbox : this.dom.visualBox; if (this.state.currentUnit === 'CSS') { if (lesson.title === '字體與排印學') this._setupTypographyPlayground(); else if (lesson.title === '盒子模型 (Box Model)') this._setupBoxModelPlayground(); else if (lesson.title === 'Flexbox 佈局') { this._setupFlexboxPlayground(); targetElement = this.dom.cssPlayground; } } const groupedCommands = lesson.commands.reduce((acc, cmd) => { const group = cmd.group || 'General'; (acc[group] = acc[group] || []).push(cmd); return acc; }, {}); Object.entries(groupedCommands).forEach(([groupName, commands]) => { const groupContainer = document.createElement('div'); groupContainer.style.cssText = "margin-bottom: 10px; border: 1px solid var(--border-color); border-radius: 8px; padding: 5px 15px 15px 15px;"; const p = document.createElement('p'); p.textContent = groupName; p.style.cssText = "font-size: 0.9em; color: var(--text-secondary-color); margin-bottom: 0px;"; groupContainer.appendChild(p); commands.forEach(cmd => { const btn = document.createElement("button"); btn.className = "command-btn"; btn.textContent = cmd.label; btn.setAttribute('aria-label', `套用: ${cmd.label}`); btn.dataset.group = cmd.group; if (this.state.currentUnit === 'CSS') { btn.dataset.property = cmd.property; btn.dataset.value = cmd.value; btn.addEventListener('click', (e) => this._handleCssCommandClick(e, targetElement)); } else { btn.dataset.content = cmd.content; btn.addEventListener('click', (e) => this._handleHtmlCommandClick(e)); } groupContainer.appendChild(btn); }); this.dom.commandButtons.appendChild(groupContainer); }); } this._renderChallengeArea(); this._switchTab('insight'); }
        _resetPlaygrounds() { this._setupDefaultPlayground(); this.dom.htmlSandbox.src = "about:blank"; this.state.activeHtmlContent = {}; }
        _setupDefaultPlayground() { const e = this.dom.visualBox; e.style.cssText = "", e.innerHTML = "", e.appendChild(document.createTextNode("Box")), Object.assign(e.style, { width: "150px", height: "150px", display: "flex", justifyContent: "center", alignItems: "center" }); const t = this.dom.cssPlayground; t.innerHTML = "", t.style.cssText = "", t.appendChild(e) }
        _setupTypographyPlayground() { const e = this.dom.visualBox; Object.assign(e.style, { width: "100%", display: "block", justifyContent: null, alignItems: null }), e.innerHTML = "網站字體設計" }
        _setupBoxModelPlayground() { const e = this.dom.cssPlayground, t = this.dom.visualBox; e.innerHTML = "", Object.assign(e.style, { flexDirection: "row", alignItems: "center", justifyContent: "center" }), Object.assign(t.style, { display: "block", justifyContent: null, alignItems: null }), t.innerHTML = ""; const o = document.createElement("div"); o.className = "content-box-inner", o.textContent = "Content", Object.assign(o.style, { width: "80px", height: "80px" }), t.appendChild(o); const s = document.createElement("div"); s.className = "box-model-sibling", s.textContent = "參考物件", e.appendChild(t), e.appendChild(s) }
        _setupFlexboxPlayground() { const e = this.dom.cssPlayground; e.innerHTML = "", e.style.height = "100%"; for (let t = 0; t < 6; t++) { const o = document.createElement("div"); o.className = "flex-item", e.appendChild(o) } }
        _handleCssCommandClick(e, t) { const o = e.currentTarget, s = o.dataset.property, i = o.dataset.value, n = o.classList.contains("active-command"), l = o.parentElement.querySelectorAll(".command-btn"); n ? (o.classList.remove("active-command"), t.style[s] = null) : (l.forEach(e => e.classList.remove("active-command")), o.classList.add("active-command"), t.style[s] = i) }
        _initializeQuizApp() { const quizDOM = { header: document.querySelector("#quiz-page-container .quiz-header"), quizView: document.getElementById("quiz-view"), resultsView: document.getElementById("results-view"), prevBtn: document.getElementById("prev-btn"), nextBtn: document.getElementById("next-btn"), retryBtn: document.getElementById("retry-btn"), reviewBtn: document.getElementById("review-btn"), homeBtn: document.getElementById("quiz-home-btn"), progress: document.getElementById("quiz-progress"), prompt: document.getElementById("question-prompt"), body: document.getElementById("question-body"), feedbackArea: document.getElementById("question-feedback-area"), finalScoreText: document.getElementById("final-score-text"), finalScoreCircle: document.getElementById("final-score-circle"), resultsTitle: document.getElementById("results-summary-title"), resultsText: document.getElementById("results-summary-text"), questionAreaWrapper: document.getElementById("question-area-wrapper") }; const quizData = this._getCurriculumData().quiz; let state = { appState: "quiz", currentQuestionIndex: 0, userAnswers: [], score: 0, currentEditor: null }; const normalizeAnswer = (e) => "string" != typeof e ? "" : e.replace(/\s|;|(\r\n|\n|\r)/gm, "").toLowerCase(); const renderQuestion = () => { state.currentEditor = null, quizDOM.questionAreaWrapper.scrollTop = 0, quizDOM.quizView.classList.toggle("is-review", "review" === state.appState), quizDOM.progress.textContent = `題目 ${state.currentQuestionIndex + 1} / ${quizData.length}`; const e = quizData[state.currentQuestionIndex]; quizDOM.prompt.innerHTML = e.prompt, quizDOM.body.innerHTML = ""; const t = "review" === state.appState; if ("mc" === e.type) { const o = document.createElement("div"); o.className = "mc-options-container", e.options.forEach((s, i) => { const n = document.createElement("div"); n.className = "mc-option"; const l = document.createElement("input"); Object.assign(l, { type: "radio", id: `q${i}`, name: `q${state.currentQuestionIndex}`, value: i, checked: state.userAnswers[state.currentQuestionIndex] === i, disabled: t }), l.addEventListener("change", e => state.userAnswers[state.currentQuestionIndex] = parseInt(e.target.value)); const a = document.createElement("label"); if (a.htmlFor = `q${i}`, a.innerHTML = s, t) { const e = state.userAnswers[state.currentQuestionIndex] === i, o = e.answer === i; e ? a.classList.add(o ? "user-correct" : "user-incorrect") : o && a.classList.add("true-correct") } n.append(l, a), o.appendChild(n) }), quizDOM.body.appendChild(o) } else { const o = document.createElement("div"); o.className = "text-input-container"; const s = document.createElement("div"); o.appendChild(s), quizDOM.body.appendChild(o); const i = this.dom.body.dataset.theme, n = "light" === i ? "neat" : "material-darker", l = "HTML" === e.topic ? "htmlmixed" : "css"; state.currentEditor = CodeMirror(s, { value: state.userAnswers[state.currentQuestionIndex] || "", mode: l, theme: n, lineNumbers: !0, lineWrapping: !0, readOnly: t }), t ? normalizeAnswer(state.currentEditor.getValue()) === normalizeAnswer(e.answer) ? state.currentEditor.getWrapperElement().classList.add("correct-text") : state.currentEditor.getWrapperElement().classList.add("incorrect-text") : state.currentEditor.on("change", e => { state.userAnswers[state.currentQuestionIndex] = e.getValue() }), setTimeout(() => state.currentEditor.refresh(), 1) } renderFeedback(), updateNavButtons() }, renderFeedback = () => { quizDOM.feedbackArea.innerHTML = "", quizDOM.feedbackArea.className = "hidden"; if ("review" !== state.appState) return; const e = quizData[state.currentQuestionIndex], t = state.userAnswers[state.currentQuestionIndex], o = "mc" === e.type ? t === e.answer : normalizeAnswer(t) === normalizeAnswer(e.answer); if (quizDOM.feedbackArea.classList.remove("hidden"), quizDOM.feedbackArea.classList.add(o ? "correct" : "incorrect"), o) quizDOM.feedbackArea.innerHTML = "<p>✓ 回答正確</p>"; else { const t = ("mc" === e.type ? e.options[e.answer] : e.answer).replace(/</g, "<"); quizDOM.feedbackArea.innerHTML = `<p>✗ 回答錯誤</p><div id="correct-answer-display"><strong>正確答案：</strong><code>${t}</code></div>` } }, updateNavButtons = () => { quizDOM.prevBtn.disabled = 0 === state.currentQuestionIndex, "quiz" === state.appState ? quizDOM.nextBtn.textContent = state.currentQuestionIndex === quizData.length - 1 ? "完成測驗" : "下一題" : "review" === state.appState && (quizDOM.nextBtn.textContent = state.currentQuestionIndex === quizData.length - 1 ? "返回總結" : "下一題") }, calculateAndShowResults = () => { state.score = quizData.reduce((e, t, o) => { const s = "mc" === t.type ? state.userAnswers[o] === t.answer : normalizeAnswer(state.userAnswers[o]) === normalizeAnswer(t.answer); return e + (s ? 1 : 0) }, 0), state.appState = "results", quizDOM.header.classList.add("hidden"), quizDOM.quizView.classList.add("hidden"), quizDOM.resultsView.classList.remove("hidden"); const e = Math.round(state.score / quizData.length * 100); quizDOM.finalScoreText.textContent = e, setTimeout(() => quizDOM.finalScoreCircle.style.background = `conic-gradient(from 0deg, var(--success-color) ${e}%, var(--surface-light) 0%)`, 100), 100 === e ? (quizDOM.resultsTitle.textContent = "完美！恭喜你全部答對！", quizDOM.resultsText.textContent = "你對 HTML 與 CSS 的基礎觀念非常紮實。") : e >= 70 ? (quizDOM.resultsTitle.textContent = "表現得很好！", quizDOM.resultsText.textContent = `你答對了 ${state.score} 題，離精通只有一步之遙。`) : (quizDOM.resultsTitle.textContent = "再接再厲！", quizDOM.resultsText.textContent = "別氣餒，複習一下錯誤的題目，你會變得更強。") }, startNewQuiz = () => { state = { appState: "quiz", currentQuestionIndex: 0, userAnswers: Array(quizData.length).fill(null), score: 0, currentEditor: null }, quizDOM.header.classList.remove("hidden"), quizDOM.resultsView.classList.add("hidden"), quizDOM.quizView.classList.remove("hidden"), renderQuestion() }; quizDOM.nextBtn.addEventListener("click", () => { state.currentQuestionIndex < quizData.length - 1 ? (state.currentQuestionIndex++, renderQuestion()) : "quiz" === state.appState ? confirm("您確定要交卷嗎？") && calculateAndShowResults() : "review" === state.appState && (quizDOM.header.classList.add("hidden"), quizDOM.resultsView.classList.remove("hidden"), quizDOM.quizView.classList.add("hidden")) }), quizDOM.prevBtn.addEventListener("click", () => { 0 < state.currentQuestionIndex && (state.currentQuestionIndex--, renderQuestion()) }), quizDOM.reviewBtn.addEventListener("click", () => { state.appState = "review", state.currentQuestionIndex = 0, quizDOM.header.classList.remove("hidden"), quizDOM.resultsView.classList.add("hidden"), quizDOM.quizView.classList.remove("hidden"), renderQuestion() }), quizDOM.retryBtn.addEventListener("click", startNewQuiz), quizDOM.homeBtn.addEventListener("click", () => this._showView("mainMenu")); return { start: startNewQuiz, getCurrentEditor: () => state.currentEditor } }

        _getCurriculumData() {
            // NOTE: The actual curriculum data is omitted here for brevity, as requested.
            // It should be the same large object from your original file.
            return {
                'HTML': {
                    title: '基礎 HTML',
                    lessons: [
                        {
                            title: '標題、段落與語意',
                            insight: `<h4>核心概念：結構與語意</h4><p>HTML 的核心是使用「標籤」(Tag) 來賦予內容不同的「語意」(Semantic)。這不僅是為了顯示，更是為了讓瀏覽器、搜尋引擎和輔助工具（如螢幕閱讀器）能理解你網頁的結構。</p><h4>標題 (Headings)</h4><p>標題從 <code>&lt;h1&gt;</code> 到 <code>&lt;h6&gt;</code>，代表了六個層級的重要性。一個頁面通常只應該有一個 <code>&lt;h1&gt;</code> 作為主標題，這對 SEO (搜尋引擎優化) 至關重要。</p><h4>段落</h4><p><code>&lt;p&gt;</code> (Paragraph) 用於定義一個獨立的文字段落。</p><p>試著點擊下方不同群組的按鈕，看看它們如何疊加顯示在右方的預覽區吧！</p>`,
                            commands: [
                                { group: '主標題 <h1>', label: "<h1>最重要的主標題</h1>", content: '<h1>最重要的主標題</h1>' },
                                { group: '主標題 <h1>', label: "<h1>通常一個頁面只會有一個&lt;h1&gt;標題</h1>", content: '<h1>通常一個頁面只會有一個&lt;h1&gt;標題</h1>' },
                                { group: '副標題 <h2>', label: "<h2>一個大標題</h2>", content: '<h2>一個大標題</h2>' },
                                { group: '副標題 <h2>', label: "<h2>可用於文章排版</h2>", content: '<h2>可用於文章排版</h2>' },
                                { group: '副標題 <h3>', label: "<h3>一個副標題</h3>", content: '<h3>一個副標題</h3>' },
                                { group: '副標題 <h3>', label: "<h3>可用於文章排版</h3>", content: '<h3>可用於文章排版</h3>' },
                                { group: '段落 <p>', label: "<p>這是一個用來解釋內容的段落。</p>", content: '<p>這是一個用來解釋內容的段落。</p>' },
                                { group: '段落 <p>', label: "<p>所以這個段落通常會很長。<br>所以這個段落通常會很長。<br>所以這個段落通常會很長。</p>", content: '<p>所以這個段落通常會很長。<br>所以這個段落通常會很長。<br>所以這個段落通常會很長。</p>' },
                            ],
                            challenge: { prompt: "挑戰：建立一個 &lt;h2&gt; 標題，內容為「我的第一個網頁」，並在其下方新增一個段落，內容是「用 HTML 寫成」。", hint: "你需要一個 <h2> 標籤，緊接著一個 <p> 標籤。", validator: (el) => { const h2 = el.querySelector('h2'); const p = el.querySelector('p'); return h2 && h2.textContent.trim() === '我的第一個網頁' && p && p.textContent.trim() === '用 HTML 寫成'; } }
                        },
                        {
                            title: '清單 (Lists)',
                            insight: `<h4>為什麼要用清單？</h4><p>當你有一組相關的項目時，使用清單標籤可以讓它們在語意上成為一個群組，這比單純用 <code>&lt;p&gt;</code> 標籤更有結構性。</p><ul><li><code>&lt;ul&gt;</code> (Unordered List)： 無序清單，用於項目的順序不重要的場合，例如購物清單。預設樣式是項目符號。</li><li><code>&lt;ol&gt;</code> (Ordered List)： 有序清單，用於步驟或排名等順序很重要的場合。預設樣式是數字。</li></ul><p>無論是哪種清單，清單項目都必須使用 <code>&lt;li&gt;</code> (List Item) 標籤包覆。清單甚至可以互相嵌套，以建立更複雜的層級結構。</p>`,
                            commands: [
                                { group: '無序清單', label: "購物清單", content: '<h4>購物清單</h4><ul><li>牛奶</li><li>麵包</li><li>雞蛋</li></ul>' },
                                { group: '無序清單', label: "待辦事項", content: '<h4>待辦事項</h4><ul><li>完成 HTML 學習</li><li>學習 CSS</li></ul>' },
                                { group: '有序清單', label: "食譜步驟", content: '<h4>食譜步驟</h4><ol><li>打蛋</li><li>加牛奶</li><li>攪拌均勻</li></ol>' },
                                { group: '有序清單', label: "排行榜", content: '<h4>排行榜</h4><ol><li>挑戰者一號</li><li>挑戰者二號</li></ol>' },
                                { group: '巢狀清單', label: "語言分類", content: '<h4>程式語言</h4><ul><li>前端語言<ul><li>HTML</li><li>CSS</li></ul></li><li>後端語言<ul><li>Python</li><li>PHP</li></ul></li></ul>' }
                            ],
                            challenge: { prompt: "挑戰：建立一個包含三個項目的有序清單，內容分別是：HTML、CSS、JavaScript。", hint: "你需要一個 <ol> 標籤，裡面包著三個 <li> 標籤。", validator: (el) => { const ol = el.querySelector('ol'); const lis = el.querySelectorAll('li'); return ol && lis.length === 3 && lis[0].textContent.trim() === 'HTML' && lis[1].textContent.trim() === 'CSS' && lis[2].textContent.trim() === 'JavaScript'; } }
                        },
                        {
                            title: '連結與圖片',
                            insight: `<h4>連結 (Anchor)</h4><p><code>&lt;a&gt;</code> 標籤是網路的基石。它的 <code>href</code> (Hypertext Reference) 屬性指向目標網址。你還可以加上 <code>target="_blank"</code> 屬性，讓連結在新分頁中開啟。</p><h4>圖片 (Image)</h4><p><code>&lt;img&gt;</code> 標籤用於嵌入圖片。<code>src</code> (Source) 屬性是圖片的來源路徑。最重要的屬性之一是 <code>alt</code> (Alternative text)，它為圖片提供替代文字，當圖片無法顯示時會出現，同時對於螢幕閱讀器和 SEO 也極為重要。</p>`,
                            commands: [
                                { group: '連結', label: "基本連結", content: '<p>點擊<a href="https://www.google.com/" >這裡</a>前往Google。</p>' },
                                { group: '連結', label: "新分頁開啟", content: '<p>這個<a href="https://www.google.com/"  target="_blank">連結</a>會在新的分頁開啟。</p>' },
                                { group: '圖片', label: "顯示圖片", content: '<img src="https://raw.githubusercontent.com/weiweiweiweiweiweiweiwei/ET-Topics/refs/heads/main/image/%E4%BA%94%E8%89%B2%E9%B3%A5.png" alt="佔位圖片" style="width:150px;">' },
                                { group: '圖片', label: "圖片替代文字", content: '<p>若圖片無法顯示，alt屬性很重要：<br><br><img src="non-existent.jpg" alt="一張無法顯示的圖片" style="width:150px;"></p>' },
                            ],
                            challenge: { prompt: "挑戰：建立一個可以點擊的圖片連結，圖片來源是 `https://via.placeholder.com/100`，點擊後應在新分頁開啟 `https://www.google.com`。", hint: "將 <img> 包在 <a> 裡面，並為 <a> 加上 href 和 target='_blank' 屬性。", validator: (el) => { const a = el.querySelector('a'); const img = a ? a.querySelector('img') : null; return a && a.href === 'https://www.google.com/' && a.target === '_blank' && img && img.src.includes('placeholder.com/100'); } }
                        },
                        {
                            title: '表格 (Tables)',
                            insight: `<h4>呈現二維數據</h4><p>HTML 表格專門用於呈現行列分明的二維數據。請避免使用表格來進行頁面排版，那是不正確的用法。</p><h5>核心結構：</h5><ul><li><code>&lt;table&gt;</code>: 表格的根元素。</li><li><code>&lt;tr&gt;</code>: 表格中的一列 (table row)。</li><li><code>&lt;th&gt;</code>: 表頭單元格 (table header)，內容預設為粗體並置中。</li><li><code>&lt;td&gt;</code>: 標準的資料單元格 (table data)。</li><li><code>&lt;caption&gt;</code>: 表格的標題。</li></ul>`,
                            commands: [
                                { group: '表格範例', label: "基本表格", content: '<table border="1" style="color:black; border-collapse:collapse; width:100%;"><tr><th>姓名</th><th>職業</th></tr><tr><td>小明</td><td>工程師</td></tr></table>' },
                                { group: '表格範例', label: "帶有標題的表格", content: '<table border="1" style="color:black; border-collapse:collapse; width:100%;"><caption>員工資料</caption><tr><th>姓名</th><th>職業</th></tr><tr><td>小華</td><td>設計師</td></tr></table>' },
                                { group: '表格範例', label: "合併儲存格的表格", content: '<table border="1" style="color:black; border-collapse:collapse; width:100%;"><tr><th>項目</th><td>A</td><td>B</td></tr><tr><th rowspan="2">時段</th><td>上午</td><td>下午</td></tr><tr><td>上午</td><td>下午</td></tr></table>' }
                            ],
                            challenge: { prompt: "挑戰：建立一個 2x2 的表格，第一列是表頭，內容為「產品」和「價格」。第二列是資料，內容為「蘋果」和「50」。", hint: "你需要 <table>, <tr>, <th>, 和 <td> 標籤。", validator: (el) => { const ths = el.querySelectorAll('th'); const tds = el.querySelectorAll('td'); return ths.length === 2 && tds.length === 2 && ths[0].textContent === '產品' && ths[1].textContent === '價格' && tds[0].textContent === '蘋果' && tds[1].textContent === '50'; } }
                        },
                        {
                            title: '語意化佈局標籤',
                            insight: `<h4>結構化你的頁面</h4><p>過去，網頁佈局大量依賴 <code>&lt;div&gt;</code>。現代 HTML5 提供了更具語意化的標籤來描述頁面的各個區塊，這對 SEO 和可訪問性有極大好處。</p><h5>常用佈局標籤：</h5><ul><li><code>&lt;header&gt;</code>: 頁面或區塊的頁首。</li><li><code>&lt;nav&gt;</code>: 導覽連結區塊。</li><li><code>&lt;main&gt;</code>: 頁面的主要內容。</li><li><code>&lt;footer&gt;</code>: 頁面或區塊的頁尾。</li></ul><p><b>提示：</b>此單元的範例會直接改變預覽區的結構，而非疊加。</p>`,
                            commands: [
                                { label: "Header 範例", action: (el) => { el.style.cssText = 'display:flex; flex-direction:column; justify-content:flex-start; min-height:300px; border:1px dashed #ccc; padding: 10px;'; el.innerHTML = '<header style="border:2px dashed blue; padding:10px; background-color: #e0f2f7; width: 100%;">這裡是用於頁面頂部的標題或導覽區塊</header>'; } },
                                { label: "Nav 範例", action: (el) => { el.style.cssText = 'display:block; min-height:auto; border:none; padding: 10px;'; el.innerHTML = `<nav style="border:2px solid green; padding:10px; background-color: #e6ffe6; text-align: center;"><a href="#" onclick="return false;" style="margin:0 15px; text-decoration:none; color: green; font-weight: bold;">首頁</a><a href="#" onclick="return false;" style="margin:0 15px; text-decoration:none; color: green; font-weight: bold;">關於我們</a><a href="#" onclick="return false;" style="margin:0 15px; text-decoration:none; color: green; font-weight: bold;">服務項目</a></nav>`; } },
                                { label: "Footer 範例", action: (el) => { el.style.cssText = 'display:flex; flex-direction:column; justify-content:flex-end; min-height:300px; border:1px dashed #ccc; padding: 10px;'; el.innerHTML = '<footer style="border:2px dashed purple; padding:10px; background-color: #f7e0f7; width: 100%;">這裡是用於頁面底部的版權或聯絡資訊區塊</footer>'; } },
                                { label: "完整結構範例", action: (el) => { el.style.cssText = 'display:flex; flex-direction:column; justify-content:space-between; min-height:400px; border:1px solid #999; padding: 0;'; el.innerHTML = `<header style="border:1px solid #ccc; padding:8px; background-color: #f0f0f0; text-align: center; color: black;">頁首 (Header)</header><main style="padding:20px; flex-grow: 1; display: flex; align-items: center; justify-content: center; background-color: #ffffff; color: black;">主要內容 (Main Content)<br>(自動填滿中間空間)</main><footer style="border:1px solid #ccc; padding:8px; background-color: #f0f0f0; text-align: center; color: black;">頁尾 (Footer)</footer>`; } }
                            ],
                            challenge: { prompt: "挑戰：建立一個包含 &lt;header&gt; 和 &lt;footer&gt; 的基本頁面結構。", hint: "你需要一個 <header> 標籤和一個 <footer> 標籤。", validator: (el) => { const header = el.querySelector('header'); const footer = el.querySelector('footer'); return header && footer; } }
                        }
                    ]
                },
                'CSS': {
                    title: '基礎 CSS',
                    lessons: [
                        {
                            title: '選擇器與基本語法',
                            insight: `<h4>CSS 的核心：選取並美化</h4><p>CSS (Cascading Style Sheets) 的基本語法是 <code>selector { property: value; }</code>。首先，你需要用「選擇器」(Selector) 選取到你想美化的 HTML 元素，然後在括號內宣告一條或多條「屬性: 值」的樣式規則。</p><h5>三種基本選擇器：</h5><ul><li><strong>元素選擇器</strong>: 直接使用標籤名稱，如 <code>p</code>。</li><li><strong>Class 選擇器</strong>: 使用點 <code>.</code> 開頭，如 <code>.my-class</code>。</li><li><strong>ID 選擇器</strong>: 使用井號 <code>#</code> 開頭，如 <code>#unique-id</code>。</li></ul><p>現在，試著點擊下方的按鈕，組合不同的樣式，看看盒子有什麼變化吧！</p>`,
                            commands: [
                                { group: '文字顏色 (color)', label: "color: pink;", property: "color", value: "pink" },
                                { group: '文字顏色 (color)', label: "color: orange;", property: "color", value: "orange" },
                                { group: '文字顏色 (color)', label: "color: #8ab4f8;", property: "color", value: "#8ab4f8" },
                                { group: '背景顏色 (background-color)', label: "background: yellow;", property: "backgroundColor", value: "yellow" },
                                { group: '背景顏色 (background-color)', label: "background: lightblue;", property: "backgroundColor", value: "lightblue" },
                                { group: '背景顏色 (background-color)', label: "background: #5f6368;", property: "backgroundColor", value: "#5f6368" },
                                { group: '字體大小 (font-size)', label: "font-size: 12px;", property: "fontSize", value: "12px" },
                                { group: '字體大小 (font-size)', label: "font-size: 24px;", property: "fontSize", value: "24px" },
                                { group: '字體大小 (font-size)', label: "font-size: 36px;", property: "fontSize", value: "36px" },
                            ],
                            challenge: { prompt: "挑戰：讓盒子的背景顏色設定為紅色 (`red`)。", hint: "請試著使用 `background-color` 屬性。例如：`background-color: red;`", validator: (el) => el.style.backgroundColor === 'red' }
                        },
                        {
                            title: '顏色與背景',
                            insight: `<h4>賦予色彩</h4><p><code>color</code> 屬性設定文字顏色，而 <code>background-color</code> 設定背景色。除了顏色名稱，更常用十六進位碼 (hex, 如 <code>#FFFFFF</code>) 或 <code>rgb()</code> / <code>rgba()</code>。</p><p><code>background-image</code> 屬性更為強大，可以用 <code>linear-gradient()</code> 來創造平滑的漸層背景。</p>`,
                            commands: [
                                { group: '背景顏色', label: "background-color: #4285F4;", property: "backgroundColor", value: "#4285F4" },
                                { group: '背景顏色', label: "background-color: #34A853;", property: "backgroundColor", value: "#34A853" },
                                { group: '背景顏色', label: "background-color: #fbbc05;", property: "backgroundColor", value: "#fbbc05" },
                                { group: '文字顏色', label: "color: #ff6d00;", property: "color", value: "#ff6d00" },
                                { group: '文字顏色', label: "color: #e8eaed;", property: "color", value: "#e8eaed" },
                                { group: '文字顏色', label: "color: black;", property: "color", value: "black" },
                                { group: '漸層背景', label: "gradient(to right, ...)", property: "backgroundImage", value: "linear-gradient(to right, #4285F4, #34A853)" },
                                { group: '漸層背景', label: "gradient(to bottom, ...)", property: "backgroundImage", value: "linear-gradient(to bottom, #EA4335, #fbbc05)" },
                                { group: '漸層背景', label: "gradient(45deg, ...)", property: "backgroundImage", value: "linear-gradient(45deg, #34A853, #1e1f20)" },
                            ],
                            challenge: { prompt: "挑戰：將盒子的背景設為十六進位碼 `#000000`，文字顏色設為 `#FFFFFF`。", hint: "你需要 `background-color` 和 `color` 兩個屬性。", validator: (el) => el.style.backgroundColor === 'rgb(0, 0, 0)' && el.style.color === 'rgb(255, 255, 255)' }
                        },
                        {
                            title: '字體與排印學',
                            insight: `<h4>文字的藝術</h4><p>美化文字是 CSS 的核心功能。你可以控制字體、大小、粗細、對齊方式等，這些共同構成了網頁的排印學 (Typography)。</p><ul><li><code>font-family</code>: 設定字體。</li><li><code>font-size</code>: 控制文字大小。</li><li><code>font-weight</code>: 控制文字粗細。</li><li><code>text-align</code>: 設定文字的水平對齊方式。</li></ul><p><b>提示：</b>為了讓 <code>text-align</code> 的效果更明顯，預覽區中的容器寬度已被設為100%。</p>`,
                            commands: [
                                { group: '字體 (font-family)', label: "黑體 (Sans-Serif)", property: "fontFamily", value: `"Microsoft JhengHei", "微軟正黑體", "PingFang TC", sans-serif` },
                                { group: '字體 (font-family)', label: "明體 (Serif)", property: "fontFamily", value: `"LiSong Pro", "Apple LiSung", "新細明體", PMingLiU, serif` },
                                { group: '字體 (font-family)', label: "楷體 (Script)", property: "fontFamily", value: `BiauKai, "標楷體", DFKai-SB, "Kaiti TC", serif` },
                                { group: '字體大小 (font-size)', label: "1rem", property: "fontSize", value: "1rem" },
                                { group: '字體大小 (font-size)', label: "1.5rem", property: "fontSize", value: "1.5rem" },
                                { group: '字體大小 (font-size)', label: "2rem", property: "fontSize", value: "2rem" },
                                { group: '字體粗細 (font-weight)', label: "normal", property: "fontWeight", value: "normal" },
                                { group: '字體粗細 (font-weight)', label: "bold", property: "fontWeight", value: "bold" },
                                { group: '文字對齊 (text-align)', label: "left", property: "textAlign", value: "left" },
                                { group: '文字對齊 (text-align)', label: "center", property: "textAlign", value: "center" },
                                { group: '文字對齊 (text-align)', label: "right", property: "textAlign", value: "right" },
                            ],
                            challenge: { prompt: "挑戰：將盒子的文字大小設為 `20px`，設為粗體 (`bold`)，並且置中對齊。", hint: "你需要 `font-size`, `font-weight`, 和 `text-align` 三個屬性。", validator: (el) => el.style.fontSize === '20px' && (el.style.fontWeight === 'bold' || el.style.fontWeight === '700') && el.style.textAlign === 'center' }
                        },
                        {
                            title: '盒子模型 (Box Model)',
                            insight: `<h4>萬物皆為盒</h4><p>CSS 的佈局基礎就是盒子模型。每個元素都被視為一個矩形盒子，它由內而外分別是：</p><ol><li><strong>Content</strong>: 內容區。</li><li><strong>Padding</strong>: 內邊距，內容與邊框之間的空間。</li><li><strong>Border</strong>: 邊框。</li><li><strong>Margin</strong>: 外邊距，邊框與其他元素之間的空間。</li></ol><p><b>提示：</b>為了讓 <code>margin</code> 和 <code>padding</code> 效果更明顯，預覽區已為您加入參考物件。</p>`,
                            commands: [
                                { group: '內邊距 (padding)', label: "padding: 10px", property: "padding", value: "10px" },
                                { group: '內邊距 (padding)', label: "padding: 25px", property: "padding", value: "25px" },
                                { group: '內邊距 (padding)', label: "padding: 40px", property: "padding", value: "40px" },
                                { group: '外邊距 (margin)', label: "margin: 10px", property: "margin", value: "10px" },
                                { group: '外邊距 (margin)', label: "margin: 20px", property: "margin", value: "20px" },
                                { group: '外邊距 (margin)', label: "margin: 40px", property: "margin", value: "40px" },
                                { group: '邊框 (border)', label: "3px solid #EA4335", property: "border", value: "3px solid #EA4335" },
                                { group: '邊框 (border)', label: "5px dashed #4285F4", property: "border", value: "5px dashed #4285F4" },
                                { group: '圓角 (border-radius)', label: "15px", property: "borderRadius", value: "15px" },
                                { group: '圓角 (border-radius)', label: "50%", property: "borderRadius", value: "50%" },
                            ],
                            challenge: { prompt: "挑戰：給盒子 `10px` 的外邊距 (`margin`)、`3px` 的實線藍色邊框 (`border`)，以及 `20px` 的內邊距 (`padding`)。", hint: "你需要 `margin`, `border`, 和 `padding` 三個屬性。", validator: (el) => el.style.margin === '10px' && el.style.border === '3px solid blue' && el.style.padding === '20px' }
                        },
                        {
                            title: 'Flexbox 佈局',
                            insight: `<h4>現代一維佈局</h4><p>Flexbox 是一種強大的一維佈局模型，極大地簡化了對齊和空間分配。在父容器上設定 <code>display: flex;</code> 即可啟用。</p><h5>核心屬性：</h5><ul><li><code>justify-content</code>: 控制項目在主軸上的對齊。</li><li><code>align-items</code>: 控制項目在交錯軸上的對齊。</li><li><code>flex-direction</code>: 改變主軸的方向。</li></ul><p><b>提示：</b>為了展示佈局效果，預覽區中已為您建立多個方塊。</p>`,
                            commands: [
                                { group: '啟用 Flexbox', label: "display: flex", property: "display", value: "flex" },
                                { group: '啟用 Flexbox', label: "display: block", property: "display", value: "block" },
                                { group: '主軸方向', label: "flex-direction: row", property: "flexDirection", value: "row" },
                                { group: '主軸方向', label: "flex-direction: column", property: "flexDirection", value: "column" },
                                { group: '主軸對齊', label: "justify-content: flex-start", property: "justifyContent", value: "flex-start" },
                                { group: '主軸對齊', label: "justify-content: center", property: "justifyContent", value: "center" },
                                { group: '主軸對齊', label: "justify-content: space-around", property: "justifyContent", value: "space-around" },
                                { group: '交錯軸對齊', label: "align-items: stretch", property: "alignItems", value: "stretch" },
                                { group: '交錯軸對齊', label: "align-items: center", property: "alignItems", value: "center" },
                                { group: '換行', label: "flex-wrap: nowrap", property: "flexWrap", value: "nowrap" },
                                { group: '換行', label: "flex-wrap: wrap", property: "flexWrap", value: "wrap" },
                            ],
                            challenge: { prompt: "挑戰：讓容器內的物件水平和垂直都置中。", hint: "在容器上使用 `display: flex`, `justify-content: center`, 和 `align-items: center`。", validator: (el) => el.style.display === 'flex' && el.style.justifyContent === 'center' && el.style.alignItems === 'center' }
                        }
                    ],
                },
                'quiz': [
                    { topic: 'HTML', type: 'mc', prompt: '在 HTML 中，哪個標籤的重要性最高，通常一個頁面只會有一個？', options: ['&lt;h6&gt;', '&lt;h1&gt;', '&lt;p&gt;', '&lt;header&gt;'], answer: 1 },
                    { topic: 'CSS', type: 'mc', prompt: '在 CSS 中，用來選取 `id="logo"` 元素的正確選擇器是什麼？', options: ['.logo', '#logo', 'logo', '&lt;logo&gt;'], answer: 1 },
                    { topic: 'HTML', type: 'mc', prompt: '當你想讓一個連結 `&lt;a&gt;` 在新分頁中開啟，應該使用哪個屬性？', options: ['target="_blank"', 'link="_new"', 'tab="new"', 'target="_new"'], answer: 0 },
                    { topic: 'CSS', type: 'mc', prompt: '`margin` 和 `padding` 的主要區別是什麼？', options: ['Margin 是內邊距，Padding 是外邊距', 'Margin 是元素邊框外的空間，Padding 是邊框內的空間', '兩者沒有區別', 'Padding 控制背景色，Margin 控制文字間距'], answer: 1 },
                    { topic: 'HTML', type: 'text', prompt: '請撰寫一個無序清單 (unordered list)，其中包含兩個清單項目 (list items)，內容分別為「蘋果」和「香蕉」。', answer: `<ul><li>蘋果</li><li>香蕉</li></ul>` },
                    { topic: 'CSS', type: 'text', prompt: '請撰寫一條 CSS 規則，將所有 `&lt;p&gt;` 標籤的文字顏色設定為紅色 (red)。', answer: `p{color:red;}` },
                    { topic: 'HTML', type: 'text', prompt: '請撰寫一個完整的圖片標籤，圖片來源是 `logo.png`，替代文字是 `公司標誌`。', answer: `<img src="logo.png" alt="公司標誌">` },
                    { topic: 'CSS', type: 'text', prompt: '請撰寫一條 CSS 規則，為 class 是 `.box` 的元素加上 `2px` 的藍色實線邊框。', answer: `.box{border:2px solid blue;}` },
                    { topic: 'HTML', type: 'mc', prompt: '哪個語意化標籤最適合用來放置網站的主要導覽列？', options: ['&lt;header&gt;', '&lt;div class=&quot;nav&quot;&gt;', '&lt;nav&gt;', '&lt;menu&gt;'], answer: 2 },
                    { topic: 'CSS', type: 'mc', prompt: '如何讓一個 Flex 容器 (flex container) 的子項目在主軸上置中對齊？', options: ['align-items: center;', 'text-align: center;', 'justify-content: center;', 'margin: auto;'], answer: 2 },
                ]
            };
        }


    }
    const app = new SynapseApp();
    app.init();
});