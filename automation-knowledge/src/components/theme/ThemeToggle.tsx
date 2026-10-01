"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribeMounted = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);

  if (!mounted) {
    return (
      <button className="theme-toggle" type="button" aria-label="Color mode" disabled>
        <Monitor aria-hidden="true" size={16} />
      </button>
    );
  }

  const dark = resolvedTheme === "dark";
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={dark ? "Dùng giao diện sáng" : "Dùng giao diện tối"}
      title={dark ? "Light mode" : "Dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
    </button>
  );
}
