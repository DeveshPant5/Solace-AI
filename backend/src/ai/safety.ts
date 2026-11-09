// A plain keyword check for clear statements of danger. It never replaces the
// model's judgement; it is a floor, so an explicit statement is still caught when
// the model call fails, is declined, or was talked out of flagging it.

export type Risk = "none" | "concern" | "crisis";

const words = (patterns: string[]) =>
  new RegExp(patterns.map((p) => String.raw`\b${p}\b`).join("|"), "i");

/** Suicide, self-harm, wanting to die. */
const CRISIS_PATTERN = words([
  String.raw`kill(ing)? my ?self`,
  String.raw`suicid\w*`,
  String.raw`end(ing)? it all`,
  String.raw`end(ing)? my life`,
  String.raw`take my (own )?life`,
  String.raw`self[- ]?harm\w*`,
  String.raw`(hurt|hurting|harm|harming|cut|cutting) my ?self`,
  String.raw`(want|wanted|wanting) to die`,
  String.raw`wanna die`,
  String.raw`(do ?n[o']?t|not|no longer) (want|wanna) (to )?(live|be alive|be here|exist)`,
  String.raw`no reason to live`,
  String.raw`better off dead`,
]);

/** Abuse and not being safe. */
const DANGER_PATTERN = words([
  String.raw`being abused`,
  String.raw`abus(ed|ive)`,
  String.raw`abuses me`,
  String.raw`not safe at home`,
]);

const normalize = (text: string) => text.toLowerCase().replace(/[‘’]/g, "'");

/** True if the text clearly mentions suicide, self-harm, abuse or not being safe. */
export function detectConcern(text: string): boolean {
  return keywordRisk(text) !== "none";
}

export function keywordRisk(text: string): Risk {
  const t = normalize(text);
  if (CRISIS_PATTERN.test(t)) return "crisis";
  if (DANGER_PATTERN.test(t)) return "concern";
  return "none";
}

const rank: Record<Risk, number> = { none: 0, concern: 1, crisis: 2 };

/**
 * Combines the model's risk with the keyword check. When the model answered, a
 * keyword hit lifts its result to at least "concern" (a phrase like "I'm not
 * suicidal" shouldn't jump straight to crisis). When the model didn't answer,
 * the keyword result is used as is.
 */
export function combineRisk(modelRisk: Risk | null | undefined, text: string): Risk {
  const keywords = keywordRisk(text);
  if (!modelRisk) return keywords;
  const floor: Risk = keywords === "none" ? "none" : "concern";
  return rank[floor] > rank[modelRisk] ? floor : modelRisk;
}
