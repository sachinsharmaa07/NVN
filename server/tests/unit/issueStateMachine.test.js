// Every (from, to, actor) triple: the allowed ones are listed by hand, everything else must be refused.
import { describe, it, expect } from "vitest";
import { ISSUE_STATUSES } from "../../src/models/Issue.js";
import { ROLES } from "../../src/utils/permissions.js";
import { checkTransition, needsNote, OPEN_STATUSES } from "../../src/utils/issueStateMachine.js";

const W = ["staff", "dept_head", "city_admin"];
const ALLOWED = {
  "submitted>assigned": W,
  "submitted>rejected": ["dept_head", "city_admin"],
  "assigned>in_progress": W,
  "in_progress>resolved": W,
  "resolved>closed": ["reporter", "system"],
  "resolved>reopened": ["reporter"],
  "reopened>assigned": W,
};
const ACTORS = [...ROLES, "reporter", "system"];

describe("issueStateMachine", () => {
  for (const from of ISSUE_STATUSES) {
    for (const to of ISSUE_STATUSES) {
      const who = ALLOWED[`${from}>${to}`];
      for (const actor of ACTORS) {
        const want = !who ? "invalid" : who.includes(actor) ? "ok" : "forbidden";
        it(`${from} -> ${to} by ${actor}: ${want}`, () => {
          expect(checkTransition(from, to, actor)).toBe(want);
        });
      }
    }
  }

  it("refuses unknown statuses and prototype keys", () => {
    expect(checkTransition("nope", "assigned", "staff")).toBe("invalid");
    expect(checkTransition("submitted", "constructor", "staff")).toBe("invalid");
    expect(checkTransition("__proto__", "assigned", "staff")).toBe("invalid");
  });

  it("needs a note only to reject or reopen", () => {
    expect(ISSUE_STATUSES.filter(needsNote)).toEqual(["reopened", "rejected"]);
  });

  it("open statuses are the ones the SLA clock runs in", () => {
    expect(OPEN_STATUSES).toEqual(["submitted", "assigned", "in_progress", "reopened"]);
  });
});
