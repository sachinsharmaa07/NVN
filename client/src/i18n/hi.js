// The whole Hindi dictionary as one lazy chunk: t.js imports this file only when Hindi is chosen.
const files = import.meta.glob(["./hi.json", "./hi/*.json"], { eager: true, import: "default" });

export default Object.assign({}, ...Object.values(files));
