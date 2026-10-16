/*
 * Input limits shared by a server library and the form that writes to it.
 * Their own module so a client component can read a number without pulling
 * the store (and through it, server code) into the browser bundle.
 */
export const LIST_LIMITS = { lists: 20, items: 50, name: 80, note: 300, byName: 60 };
export const QUESTION_MAX = 600;
export const ANSWER_MAX = 2000;
