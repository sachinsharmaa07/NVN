// One place to read the time, so tests can freeze it (vi.useFakeTimers({ toFake: ["Date"] })).
export const clock = { now: () => new Date() };
