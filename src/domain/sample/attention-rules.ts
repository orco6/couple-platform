/**
 * SAMPLE DOMAIN — derived attention rules (soft exceptions).
 *
 * Each rule is a scoped query. None of these is an error: the records are
 * valid, somebody should just look. Fix the data and the item disappears.
 */

import { can } from '@/core/access/can';
import { addDays, formatCalendarDate, fromDbDate, todayIn, toDbDate } from '@/core/dates/calendar-date';
import { activeOnly } from '@/core/db/history';
import { defineAttentionRule } from '@/core/follow-ups/attention';
import { getSetting } from '@/core/settings/settings';
import { customerScope } from './customers';
import { taskScope } from './tasks';

const OPEN_STATES = { in: ['OPEN', 'IN_PROGRESS'] as Array<'OPEN' | 'IN_PROGRESS'> };

export const sampleAttentionRules = [
  defineAttentionRule({
    key: 'tasks.overdue',
    label: 'משימות שעבר מועד היעד שלהן',
    description: 'משימות פתוחות שתאריך היעד שלהן כבר עבר. כדאי לעדכן תאריך או לסגור.',
    severity: 'urgent',
    async list(client, actor, { limit }) {
      const where = { AND: [taskScope(actor), activeOnly, { status: OPEN_STATES, dueDate: { lt: toDbDate(todayIn()) } }] };
      const [rows, total] = await Promise.all([
        client.task.findMany({
          where,
          select: { id: true, title: true, dueDate: true, customer: { select: { name: true } } },
          orderBy: { dueDate: 'asc' },
          take: limit,
        }),
        client.task.count({ where }),
      ]);
      return {
        total,
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          detail: `${row.customer.name} · יעד ${formatCalendarDate(fromDbDate(row.dueDate!))}`,
          href: `/tasks/${row.id}`,
        })),
      };
    },
  }),
  defineAttentionRule({
    key: 'tasks.due_soon',
    label: 'משימות שמועד היעד שלהן מתקרב',
    description: 'משימות פתוחות שמועד היעד שלהן בימים הקרובים.',
    severity: 'attention',
    async list(client, actor, { limit }) {
      const today = todayIn();
      const days = await getSetting(client, 'tasks.due_soon_days');
      const where = {
        AND: [
          taskScope(actor),
          activeOnly,
          { status: OPEN_STATES, dueDate: { gte: toDbDate(today), lte: toDbDate(addDays(today, days)) } },
        ],
      };
      const [rows, total] = await Promise.all([
        client.task.findMany({
          where,
          select: { id: true, title: true, dueDate: true, customer: { select: { name: true } } },
          orderBy: { dueDate: 'asc' },
          take: limit,
        }),
        client.task.count({ where }),
      ]);
      return {
        total,
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          detail: `${row.customer.name} · יעד ${formatCalendarDate(fromDbDate(row.dueDate!))}`,
          href: `/tasks/${row.id}`,
        })),
      };
    },
  }),
  defineAttentionRule({
    key: 'tasks.done_unpriced',
    label: 'משימות שבוצעו ללא מחיר',
    description: 'משימה שבוצעה בלי מחיר לא נספרת בהכנסות החודש. יש לקבוע מחיר לפני סגירת החודש.',
    severity: 'attention',
    async list(client, actor, { limit }) {
      if (!can(actor, 'tasks.set_price')) return { total: 0, items: [] };
      const where = { AND: [taskScope(actor), activeOnly, { status: 'DONE' as const, priceAgorot: null }] };
      const [rows, total] = await Promise.all([
        client.task.findMany({
          where,
          select: { id: true, title: true, customer: { select: { name: true } } },
          orderBy: { completedOn: 'asc' },
          take: limit,
        }),
        client.task.count({ where }),
      ]);
      return { total, items: rows.map((row) => ({ id: row.id, title: row.title, detail: row.customer.name, href: `/tasks/${row.id}` })) };
    },
  }),
  defineAttentionRule({
    key: 'customers.no_contact',
    label: 'לקוחות ללא פרטי קשר',
    description: 'לקוחות שאין להם טלפון או דוא״ל. כדאי להשלים כשמתאפשר.',
    severity: 'info',
    async list(client, actor, { limit }) {
      const where = { AND: [customerScope(actor), activeOnly, { phone: null, email: null }] };
      const [rows, total] = await Promise.all([
        client.customer.findMany({ where, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: limit }),
        client.customer.count({ where }),
      ]);
      return { total, items: rows.map((row) => ({ id: row.id, title: row.name, href: `/customers/${row.id}` })) };
    },
  }),
];
