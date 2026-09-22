/**
 * Hebrew copy for שנינו — the only place a user-facing domain sentence lives.
 *
 * Tone (BUSINESS_BRIEF §19, and the playbook's copy rules):
 *   • Speak to the two of them ("שלנו"), not to a user ("שלך").
 *   • Warm, but never gushing. No exclamation marks, no emoji as icons, none
 *     of the banned filler ("ברוכים הבאים", "כל מה שצריך במקום אחד").
 *   • Their words: משימה, הרשימה שלנו, סגירת היום, ביצוע, כיבוד, פתק, רצף.
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
    you: 'אני',
    both: 'שנינו',
    cancel: 'ביטול',
    save: 'שמירה',
    add: 'הוספה',
    edit: 'עריכה',
    reason: 'סיבה',
    today: 'היום',
    yesterday: 'אתמול',
    waiting: 'ממתין',
    notYet: 'עוד לא',
  },

  nav: {
    today: 'היום',
    review: 'סגירת היום',
    summaries: 'סיכומים',
  },

  tasks: {
    pageTitle: 'הרשימה שלנו',
    openCount: (n: number) => (n === 1 ? 'משימה אחת נשארה' : `${n} משימות נשארו`),
    allClosed: 'סגרתם הכל',
    allClosedWhy: 'הרשימה ריקה והיום עוד לא נגמר.',
    closedToday: 'נסגר היום',
    archived: 'בארכיון',

    forWhom: {
      ME: 'עליי',
      PARTNER: (name: string) => `על ${name}`,
      BOTH: 'שנינו',
    },
    forWhomLabel: 'בשביל מי',
    forWhomChoice: {
      ME: 'עליי',
      PARTNER: 'על הפרטנר',
      BOTH: 'שנינו',
    },

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
    archiveBody:
      'המשימה תצא מהרשימה ולא תיספר בסיכומים. היא לא נמחקת, ואפשר להחזיר אותה.',
    archiveReasonLabel: 'למה היא כבר לא רלוונטית',
    restoreAction: 'החזרה לרשימה',
    restoreTitle: 'החזרה לרשימה',
    restoreBody: 'המשימה תחזור לרשימה כפתוחה ותיספר שוב בסיכומים.',
    restoreReasonLabel: 'למה היא חוזרת',

    emptyTitle: 'אין משימות ליום הזה',
    emptyWhy: 'כל מה שתוסיפו יופיע כאן לשניכם.',
    emptyArchiveTitle: 'הארכיון ריק',
    emptyArchiveWhy: 'משימות שתעבירו לארכיון יישמרו כאן.',
  },

  day: {
    pageTitle: 'סגירת היום',
    question: 'איך היה היום שלנו?',

    executionLabel: 'ביצוע',
    executionQuestion: 'עמדתי בצד שלי של היום',
    respectLabel: 'כיבוד',
    respectQuestion: 'הרגשתי מכובד/ת על ידי הפרטנר',
    noteLabel: 'פתק',
    noteHint: 'לא חייב. רק אם יש משהו שכדאי לזכור.',
    notePlaceholder: 'משהו מהיום',

    /** The five steps. Same wording in both scales, so the scale is learned once. */
    scale: {
      1: 'בכלל לא',
      2: 'מעט',
      3: 'בסדר',
      4: 'טוב',
      5: 'לגמרי',
    },
    scaleHint: 'גררו למעלה או למטה',

    submitAction: 'סגירת היום',
    amendAction: 'שינוי מה שכתבתי',
    amendTitle: 'שינוי הסגירה',

    notOpenYetTitle: 'עוד מוקדם',
    notOpenYetWhy: (time: string) => `אפשר לסגור את היום מ-${time}.`,
    notOpenYetWhat: 'עד אז אפשר להמשיך לסמן משימות.',

    waitingTitle: (name: string) => `${name} עוד לא סגר/ה את היום`,
    waitingWhy: 'מה שכתבתם יתגלה לשניכם ברגע ששניכם תסגרו.',
    partnerClosedAlready: (name: string) => `${name} כבר סגר/ה. מה שנכתב יתגלה כשתסגרו גם אתם.`,
    partnerNotClosedYet: (name: string) => `${name} עוד לא סגר/ה.`,

    revealedTitle: 'שניכם סגרתם',
    frozenNotice: 'אחרי שהיום נגלה, מה שנכתב נשאר כמו שהוא.',

    gapExact: 'אותו יום, אותה הרגשה.',
    gapClose: 'קרוב מאוד.',
    gapFar: 'היום הזה נראה לכם אחרת.',

    alreadyClosed: 'סגרתם את היום הזה.',
    noteFrom: (name: string) => `הפתק של ${name}`,
    myNote: 'הפתק שלי',

    emptyTitle: 'היום הזה לא נסגר',
    emptyWhy: 'אף אחד מכם לא סגר אותו, ואפשר עוד להשלים.',
  },

  summaries: {
    pageTitle: 'הסיכומים שלנו',
    week: 'שבוע',
    month: 'חודש',
    rangeLabel: 'טווח',

    coupleAverage: 'הממוצע שלנו',
    coupleAverageHint: 'מהימים ששניכם סגרתם.',
    myAverage: 'הממוצע שלי',
    partnerAverage: (name: string) => `הממוצע של ${name}`,
    outOfFive: 'מתוך 5',

    pulseTitle: 'הקצב שלנו',
    pulseHint: 'ביצוע וכיבוד, יום אחר יום.',

    streakTitle: 'רצף',
    streakDays: (n: number) => (n === 1 ? 'יום אחד' : `${n} ימים`),
    streakNone: 'עוד אין רצף',
    streakHint: 'ימים רצופים ששניכם סגרתם.',

    tasksTitle: 'משימות',
    tasksDone: (done: number, total: number) => `${done} מתוך ${total} נסגרו`,
    tasksSplit: 'מי סגר מה',

    bestDayTitle: 'היום הטוב של החודש',
    bestDayNone: 'עוד אין יום ששניכם סגרתם',

    daysClosed: (n: number) => (n === 1 ? 'יום אחד נסגר על ידי שניכם' : `${n} ימים נסגרו על ידי שניכם`),

    emptyTitle: 'עוד אין מה לסכם',
    emptyWhy: 'הסיכום נבנה מהימים שסגרתם.',
    emptyWhat: 'סגרו יום אחד ונתחיל.',

    previousRange: 'הטווח הקודם',
    nextRange: 'הטווח הבא',
  },

  settings: {
    reviewTimeLabel: 'השעה שממנה אפשר לסגור את היום',
    reviewTimeDescription:
      'לפני השעה הזאת אי אפשר לסגור את היום. שינוי השעה לא משנה שום יום שנסגר בעבר.',
    reviewTimeReadOnly: 'רק הבעלים משנה את השעה המשותפת.',
    displayOrderLabel: 'מי מוצג ראשון',
    displayOrderDescription: 'בתצוגות שבהן שניכם מופיעים זה לצד זה.',
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
    ratingOutOfRange: 'בחרו דירוג בין 1 ל-5.',
    noPartnerYet: 'עוד אין פרטנר שני. הזמינו אותו כדי לסגור יום ביחד.',
  },
} as const;
