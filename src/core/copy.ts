/**
 * User-facing text owned by the core platform (Hebrew by default).
 *
 * Every sentence the core shows a person lives here, so a project with a
 * different tone, or a different language, changes one file. Domain text lives
 * with the domain.
 *
 * Voice: name the thing, state what happened or what to do. No apology, no
 * exclamation marks, no "Oops". Neutral grammatical forms where Hebrew allows,
 * so a sentence does not assume the reader's gender.
 */

export const copy = {
  errors: {
    validation: 'חלק מהשדות לא מולאו כראוי.',
    authentication: 'ההתחברות הסתיימה. יש להתחבר מחדש כדי להמשיך.',
    /** A save that failed because the session ended: the typed data is still on screen. */
    sessionEndedKeepInput: 'ההתחברות הסתיימה והשינוי לא נשמר. מה שהוקלד עדיין כאן.',
    sessionEndedNotice: 'ההתחברות הסתיימה. כדי לא לאבד את מה שהוקלד, אפשר להתחבר מחדש בלשונית חדשה ואז לשמור שוב כאן.',
    sessionEndedSignIn: 'התחברות מחדש בלשונית חדשה',
    sessionRestored: 'ההתחברות חודשה. אפשר לשמור שוב.',
    authorization: 'אין הרשאה לבצע את הפעולה הזו.',
    passwordChangeRequired: 'יש לבחור סיסמה חדשה לפני שממשיכים.',
    notFound: 'הפריט המבוקש לא נמצא.',
    conflict: 'הפעולה מתנגשת בנתונים קיימים.',
    staleWrite: 'הנתונים שונו בינתיים על ידי מישהו אחר. יש לרענן ולנסות שוב.',
    unexpected: 'משהו השתבש. אפשר לנסות שוב בעוד רגע.',
    offline: 'אין חיבור לשרת. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב.',
    badRequest: 'הבקשה לא נשלחה כראוי.',
    payloadTooLarge: 'הבקשה גדולה מדי.',
    duplicateRequest: 'הבקשה הזו כבר נשלחה ועדיין מטופלת.',
    crossOrigin: 'הבקשה נחסמה מטעמי אבטחה.',
  },
  auth: {
    invalidCredentials: 'שם המשתמש או הסיסמה אינם נכונים.',
    missingCredentials: 'יש למלא שם משתמש וסיסמה.',
    throttled: 'היו יותר מדי ניסיונות התחברות. אפשר לנסות שוב בעוד כמה דקות.',
    currentPasswordWrong: 'הסיסמה הנוכחית שגויה.',
    passwordSameAsCurrent: 'הסיסמה החדשה צריכה להיות שונה מהנוכחית.',
    passwordTooShort: (min: number) => `הסיסמה צריכה להכיל לפחות ${min} תווים.`,
    passwordTooLong: 'הסיסמה ארוכה מדי.',
    passwordTooCommon: 'הסיסמה הזו נפוצה מדי וקלה לניחוש. כדאי לבחור אחרת.',
    passwordContainsUsername: 'הסיסמה לא יכולה להכיל את שם המשתמש.',
    passwordsDoNotMatch: 'הסיסמאות אינן תואמות.',
    pastedCharactersRemoved: 'הוסרו תווים בלתי נראים שהגיעו עם ההדבקה.',
  },
  users: {
    notFound: 'המשתמש לא נמצא.',
    usernameTaken: 'שם המשתמש הזה כבר תפוס.',
    emailTaken: 'כתובת הדוא״ל הזו כבר משויכת למשתמש אחר.',
    usernameFormat: 'שם משתמש: אותיות באנגלית, ספרות, נקודה, מקף או קו תחתון (3–32 תווים).',
    unknownRole: 'תפקיד לא מוכר.',
    cannotChangeOwnRole: 'אי אפשר לשנות את התפקיד של עצמך.',
    cannotDisableSelf: 'אי אפשר להשבית את המשתמש שאיתו מחוברים כרגע.',
    cannotManageHigherRole: 'אין הרשאה לנהל משתמש בתפקיד הזה.',
    lastAdministrator:
      'זה המשתמש הפעיל האחרון שיכול לנהל משתמשים. יש למנות משתמש נוסף עם ההרשאה לפני השינוי.',
  },
  periods: {
    closed: (label: string) => `${label} סגור. כדי לשנות נתונים בתקופה הזו צריך לפתוח אותה מחדש.`,
    alreadyClosed: 'התקופה כבר סגורה.',
    alreadyOpen: 'התקופה פתוחה.',
    reasonRequired: 'יש לציין סיבה.',
  },
  lifecycle: {
    invalidTransition: (from: string, to: string) => `אי אפשר לעבור מ״${from}״ ל״${to}״.`,
    reasonRequired: 'המעבר הזה מחייב לציין סיבה.',
  },
  common: {
    close: 'סגירה',
    cancel: 'ביטול',
    save: 'שמירה',
    loading: 'טוען…',
    retry: 'לנסות שוב',
    more: 'עוד',
    search: 'חיפוש',
    clear: 'ניקוי',
    empty: '—',
    yes: 'כן',
    no: 'לא',
    next: 'הבא',
    previous: 'הקודם',
    showPassword: 'הצגת הסיסמה',
    hidePassword: 'הסתרת הסיסמה',
    openCalendar: 'פתיחת לוח שנה',
    signOut: 'יציאה',
    skipToContent: 'דילוג לתוכן',
    requiredMark: 'שדה חובה',
  },
  validation: {
    required: (label: string) => `${label} הוא שדה חובה`,
    tooShort: (label: string, min: number) => `${label} צריך להכיל לפחות ${min} תווים`,
    tooLong: (label: string, max: number) => `${label} ארוך מדי (עד ${max} תווים)`,
    invalidDate: 'תאריך לא תקין. יש לכתוב בתבנית DD.MM.YYYY',
    invalidTime: 'שעה לא תקינה. יש לכתוב בתבנית HH:MM',
    invalidMoney: 'יש לכתוב סכום במספרים, עד שתי ספרות אחרי הנקודה',
    negativeMoney: 'הסכום לא יכול להיות שלילי',
    moneyTooLarge: 'הסכום גבוה בצורה חריגה',
    invalidEmail: 'כתובת דוא״ל לא תקינה',
    invalidPhone: 'מספר טלפון לא תקין',
    invalidChoice: 'יש לבחור אחת מהאפשרויות',
    unknownField: 'השדה הזה לא מתקבל בבקשה',
  },
} as const;
