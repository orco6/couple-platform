/**
 * Hebrew copy for שנינו — the only place a user-facing domain sentence lives.
 *
 * Tone (BUSINESS_BRIEF §19, and the playbook's copy rules):
 *   • Speak to the two of them ("שלנו"), not to a user ("שלך").
 *   • Warm, but never gushing. No exclamation marks, no emoji as icons, none
 *     of the banned filler ("ברוכים הבאים", "כל מה שצריך במקום אחד").
 *   • Their words: משימה, הרשימה שלנו, סגירת היום, כיבוד, פתק, רצף.
 *     Never רשומה / ישות / פריט / משתמש when a partner is meant.
 *   • Buttons are verb + object. Empty states say what, why, and what to do.
 *   • Read at 23:40 in bed. Short wins.
 *
 * This file is a dictionary, not a template: every value is a string or a
 * function returning a string, and its type becomes the contract a second
 * language must satisfy (see ./index.ts).
 */

export const he = {
  common: {
    partnerFallback: 'הפרטנר',
    me: 'אני',
    both: 'שנינו',
    cancel: 'ביטול',
    save: 'שמירה',
    add: 'הוספה',
    edit: 'עריכה',
    reason: 'סיבה',
    today: 'היום',
    yesterday: 'אתמול',
    outOfFive: 'מתוך 5',
  },

  nav: {
    today: 'היום',
    /** Four items share a 402px bar — the label has to be one short word. */
    review: 'סגירה',
    week: 'שבוע',
    month: 'חודש',
  },

  tasks: {
    pageTitle: 'הרשימה שלנו',
    openCount: (n: number) => (n === 1 ? 'משימה אחת נשארה' : `${n} משימות נשארו`),
    allClosed: 'סגרתם הכל',
    allClosedWhy: 'הרשימה ריקה והיום עוד לא נגמר.',
    closedToday: 'נסגר היום',
    archived: 'בארכיון',

    ownerLabel: 'באחריות',
    ownerMe: 'עליי',
    ownerPartner: (name: string) => `על ${name}`,

    titleLabel: 'מה צריך לעשות',
    titlePlaceholder: 'לאסוף את הכביסה',
    dateLabel: 'לאיזה יום',
    timeLabel: 'עד שעה',
    timeHint: 'לא חייב.',
    noteLabel: 'פתק',
    noteHint: 'לא חייב.',
    dueBy: (time: string) => `עד ${time}`,
    completedBy: (name: string) => `נסגרה על ידי ${name}`,

    addAction: 'הוספת משימה',
    addTitle: 'משימה חדשה',
    editTitle: 'עריכת משימה',
    completeAction: 'סימון כנסגרה',
    reopenAction: 'פתיחה מחדש',
    archiveAction: 'העברה לארכיון',
    archiveTitle: 'העברה לארכיון',
    archiveBody: 'המשימה תצא מהרשימה ולא תיספר בסיכומים. היא לא נמחקת, ואפשר להחזיר אותה.',
    archiveReasonLabel: 'למה היא כבר לא רלוונטית',
    restoreAction: 'החזרה לרשימה',

    emptyTitle: 'אין משימות ליום הזה',
    emptyWhy: 'כל מה שתוסיפו יופיע כאן לשניכם.',
    emptyArchiveTitle: 'הארכיון ריק',
    emptyArchiveWhy: 'משימות שתעבירו לארכיון יישמרו כאן.',
  },

  taskRating: {
    /** Shown to the owner after they finish: it is the other person's turn. */
    awaiting: (name: string) => `ממתין לדירוג של ${name}`,
    awaitingShort: 'ממתין לדירוג',
    /** Shown to the partner who may rate. */
    prompt: 'איך יצא?',
    promptFor: (name: string) => `${name} סגר/ה את זה. איך יצא?`,
    ratedBy: (name: string, value: number) => `${name} נתן/ה ${value}`,
    myRating: (value: number) => `נתתי ${value}`,
    change: 'שינוי הדירוג',
    saved: 'נשמר',
    /** The five steps. Kind, but honest enough to be worth giving. */
    scale: {
      1: 'לא יצא',
      2: 'ככה ככה',
      3: 'בסדר',
      4: 'טוב',
      5: 'מושלם',
    },
    nothingToRate: 'אין כרגע משימות לדירוג',
    nothingToRateWhy: 'כשהפרטנר יסגור משימה, היא תופיע כאן.',
    sectionTitle: 'מחכה לדירוג שלי',
  },

  day: {
    pageTitle: 'סגירת היום',
    question: 'איך היה בינינו היום?',

    respectLabel: 'כיבוד ותקשורת',
    respectQuestion: 'הרגשתי מכובד/ת, ודיברנו טוב',
    noteLabel: 'פתק',
    noteHint: 'לא חייב. רק אם יש משהו שכדאי לזכור.',
    notePlaceholder: 'משהו מהיום',

    scale: {
      1: 'היה קשה',
      2: 'לא פשוט',
      3: 'בסדר',
      4: 'טוב',
      5: 'מעולה',
    },

    chooseFirst: 'בחרו דירוג כדי לסגור את היום.',
    submitAction: 'סגירת היום',
    amendAction: 'שינוי מה שכתבתי',

    notOpenYetTitle: 'עוד מוקדם',
    notOpenYetWhy: (time: string) => `אפשר לסגור את היום מ-${time}.`,
    notOpenYetWhat: 'עד אז אפשר להמשיך לסמן משימות.',
    notOpenYetOpenTasks: (n: number) => (n === 1 ? 'משימה אחת עוד פתוחה' : `${n} משימות עוד פתוחות`),
    notOpenYetNothingOpen: 'הרשימה כבר ריקה.',
    backToList: 'לרשימה',

    waitingTitle: (name: string) => `${name} עוד לא סגר/ה את היום`,
    waitingWhy: 'מה שכתבתם יתגלה לשניכם ברגע ששניכם תסגרו.',
    partnerClosedAlready: (name: string) => `${name} כבר סגר/ה. מה שנכתב יתגלה כשתסגרו גם אתם.`,

    revealedTitle: 'שניכם סגרתם',
    seeWhatYouWrote: 'לראות מה כתבתם',
    frozenNotice: 'אחרי שהיום נגלה, מה שנכתב נשאר כמו שהוא.',

    gapExact: 'אותו יום, אותה הרגשה.',
    gapClose: 'קרוב מאוד.',
    gapFar: 'היום הזה נראה לכם אחרת.',

    alreadyClosed: 'סגרתם את היום הזה.',
    myNote: 'הפתק שלי',
    noteFrom: (name: string) => `הפתק של ${name}`,

    emptyTitle: 'היום הזה לא נסגר',
    emptyWhy: 'אף אחד מכם לא סגר אותו, ואפשר עוד להשלים.',
  },

  summariesNav: {
    previous: 'הטווח הקודם',
    next: 'הטווח הבא',
  },

  week: {
    pageTitle: 'השבוע שלנו',
    /** Saturday is the end of the Hebrew week, so that is when it is ready. */
    readyOn: 'הסיכום מתעדכן בכל שבת',
    range: (from: string, to: string) => `${from} — ${to}`,

    completionTitle: 'הרשימה',
    completionDetail: (done: number, total: number) => `${done} מתוך ${total}`,

    executionTitle: 'ביצוע',
    executionHint: 'הממוצע של דירוגי המשימות.',

    respectTitle: 'כיבוד',
    respectHint: 'הממוצע של סגירות היום.',

    highlightsTitle: 'מה עבד',
    streakDays: (n: number) => (n === 1 ? 'יום אחד רצוף' : `${n} ימים רצופים`),
    streakHint: 'ששניכם סגרתם.',
    bestDay: (date: string) => `היום הטוב: ${date}`,
    allTasksDone: 'סגרתם את כל הרשימה',
    perfectTask: (title: string) => `«${title}» קיבלה 5`,

    insightTitle: 'מחשבה אחת לשבוע הבא',
    insight: {
      unbalancedTasks: (name: string) => `רוב המשימות היו על ${name}. שווה לחלק אחרת.`,
      lowCompletion: 'נסגרה פחות מחצי מהרשימה. אולי כדאי לשים פחות משימות ליום.',
      unratedTasks: (n: number) =>
        n === 1 ? 'משימה אחת שנסגרה עוד מחכה לדירוג. זה לוקח שנייה.' : `${n} משימות שנסגרו מחכות לדירוג. זה לוקח שנייה.`,
      fewClosedDays: 'סגרתם ביחד מעט ימים. אפילו שלוש פעמים בשבוע משנה את התמונה.',
      respectDip: 'הכיבוד ירד לקראת סוף השבוע. שווה לשים לב לימים העמוסים.',
      allGood: 'שבוע טוב. אין מה לשפר — תמשיכו ככה.',
    },

    emptyTitle: 'השבוע עוד לא התחיל להתמלא',
    emptyWhy: 'הסיכום נבנה מהמשימות שסגרתם ומהימים שדירגתם.',
    emptyWhat: 'סגרו משימה אחת או יום אחד ונתחיל.',
  },

  month: {
    pageTitle: 'החודש שלנו',
    weeklyAveragesTitle: 'שבוע אחר שבוע',
    completionTrendTitle: 'מגמת הרשימה',
    toneTrendTitle: 'מגמת הכיבוד',
    weekLabel: (index: number) => `שבוע ${index}`,
    trendUp: 'במגמת עלייה',
    trendDown: 'במגמת ירידה',
    trendFlat: 'יציב',
    noData: 'אין נתונים',

    emptyTitle: 'עוד אין חודש לסכם',
    emptyWhy: 'הסיכום החודשי נבנה מהשבועות שכבר סיכמתם.',
    emptyWhat: 'חזרו בסוף השבוע הראשון.',
  },

  archivePage: {
    pageTitle: 'בארכיון',
    description: 'משימות שהוצאתם מהרשימה. הן לא נספרות בסיכומים, והן לא נמחקות.',
    emptyTitle: 'הארכיון ריק',
    emptyWhy: 'משימה שיוצאת מהרשימה מופיעה כאן, עם הסיבה שכתבתם.',
    reasonGiven: 'הסיבה שנכתבה',
    restoreTitle: 'החזרה לרשימה',
    restoreDone: 'המשימה חזרה לרשימה',
    restoreBody: 'המשימה תחזור לרשימה כפתוחה, ביום שהיא הייתה משויכת אליו.',
    restoreReasonLabel: 'למה היא חוזרת',
  },

  settings: {
    pageTitle: 'הגדרות',
    reviewTimeSaved: 'השעה נשמרה',
    partnerSaved: 'הפרטנר קושר',
    partnerBoth: (a: string, b: string) => `${a} ו${b}`,
    partnerLinkHint: 'הפרטנר צריך חשבון פעיל. חשבון חדש נוצר במסך המשתמשים.',
    noLinkableUsers: 'אין עוד חשבון פעיל לקשר. צרו אחד במסך המשתמשים.',
    reviewTimeLabel: 'השעה שממנה אפשר לסגור את היום',
    reviewTimeDescription: 'לפני השעה הזאת אי אפשר לסגור את היום. שינוי השעה לא משנה שום יום שנסגר בעבר.',
    reviewTimeReadOnly: 'רק הבעלים משנה את השעה המשותפת.',
    partnerTitle: 'הפרטנר',
    partnerNone: 'עוד לא קישרתם פרטנר שני.',
    partnerLinkAction: 'קישור פרטנר',
    partnerLabel: 'מי הפרטנר',
  },

  attention: {
    unclosedDay: (date: string) => `${date} לא נסגר`,
    unclosedDayHint: 'אפשר להשלים אותו, ואפשר להשאיר.',
  },

  errors: {
    reviewNotOpenYet: (time: string) => `אפשר לסגור את היום מ-${time}.`,
    alreadySubmitted: 'סגרתם את היום הזה כבר.',
    frozenAfterReveal: 'היום הזה כבר נגלה לשניכם, ומה שנכתב נשאר כמו שהוא.',
    notYourEntry: 'אפשר לשנות רק את מה שאתם כתבתם.',
    taskChangedMeanwhile: 'המשימה השתנתה בינתיים. רעננו ונסו שוב.',
    noPartnerYet: 'עוד אין פרטנר שני. קשרו אותו בהגדרות.',
    notInPartnership: 'החשבון הזה לא מקושר לזוג הזה.',
    ownerMustBePartner: 'בחרו אחד משניכם.',
    rateOnlyCompleted: 'אפשר לדרג רק משימה שנסגרה.',
    rateNotOwnTask: 'את המשימות שלכם מדרג הצד השני.',
    rateAlreadyRated: 'המשימה כבר דורגה.',
  },
} as const;
