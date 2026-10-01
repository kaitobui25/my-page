export function hasFlag(name: string, args = process.argv.slice(2)) {
  return args.includes(name);
}

export function getOption(name: string, args = process.argv.slice(2)) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

export function getStorageLocation(args = process.argv.slice(2)): "local" | "remote" {
  const local = args.includes("--local");
  const remote = args.includes("--remote");
  if (local && remote) throw new Error("Use either --local or --remote, not both.");
  return remote ? "remote" : "local";
}

export function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}
