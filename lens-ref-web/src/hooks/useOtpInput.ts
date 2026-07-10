import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { OTP_LENGTH } from "../content";

// Mechanics for the segmented code input: auto-focus, auto-advance,
// backspace-back, and paste-across-boxes. Layouts own all styling.
export function useOtpInput() {
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setRef = (i: number) => (el: HTMLInputElement | null) => {
    refs.current[i] = el;
  };

  const fillFrom = (start: number, text: string) => {
    const ds = text.replace(/\D/g, "");
    if (!ds) return;
    setDigits((prev) => {
      const next = [...prev];
      for (let j = 0; j < ds.length && start + j < OTP_LENGTH; j++) {
        next[start + j] = ds[j];
      }
      return next;
    });
    refs.current[Math.min(start + ds.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleChange = (i: number, value: string) => {
    if (value === "") {
      setDigits((prev) => {
        const next = [...prev];
        next[i] = "";
        return next;
      });
      return;
    }
    // Typing into an already-filled box: keep only the new character.
    let text = value;
    if (value.length === 2 && digits[i] !== "" && value.startsWith(digits[i])) {
      text = value.slice(1);
    }
    fillFrom(i, text);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && digits[i] === "" && i > 0) {
      e.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        next[i - 1] = "";
        return next;
      });
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const ds = e.clipboardData.getData("text").replace(/\D/g, "");
    // A full code pasted anywhere fills from the first box.
    fillFrom(ds.length >= OTP_LENGTH ? 0 : i, ds);
  };

  const complete = digits.every((d) => d !== "");

  const reset = () => {
    setDigits(Array(OTP_LENGTH).fill(""));
    refs.current[0]?.focus();
  };

  return {
    digits,
    setRef,
    handleChange,
    handleKeyDown,
    handlePaste,
    complete,
    code: digits.join(""),
    reset,
  };
}
