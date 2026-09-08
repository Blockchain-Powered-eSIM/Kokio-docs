import React, { type FormEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import Link from "@docusaurus/Link";
import styles from "./SearchBar.module.css";

interface Source {
  title: string;
  url: string;
}

interface AskResponse {
  answer: string | null;
  sources: Source[];
  degraded?: "quota" | "unavailable";
}

type Status =
  | "idle"
  | "loading"
  | "answer"
  | "degraded"
  | "no-match"
  | "rate-limited"
  | "error";

type AnswerBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

const MAX_QUESTION_LENGTH = 300;

// Turns "- " lines into a list, blank lines into paragraph breaks.
// Kept local: this is the only place plain-text answers get rendered.
function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: "p", text: paragraphLines.join(" ") });
      paragraphLines = [];
    }
  };
  const flushBullets = () => {
    if (bulletItems.length > 0) {
      blocks.push({ type: "ul", items: bulletItems });
      bulletItems = [];
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "") {
      flushParagraph();
      flushBullets();
    } else if (line.startsWith("- ")) {
      flushParagraph();
      bulletItems.push(line.slice(2));
    } else {
      flushBullets();
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return blocks;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Navbar search trigger and modal. Sends the reader's question to /api/ask
 * and renders the answer plus the doc pages it drew from.
 */
export default function SearchBar(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [degraded, setDegraded] = useState<"quota" | "unavailable" | undefined>(undefined);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  const close = () => setIsOpen(false);

  // Global "/" and cmd+K / ctrl+K shortcuts, ignored while the reader is
  // already typing somewhere else on the page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const isSlash = event.key === "/" && !event.metaKey && !event.ctrlKey;
      const isModK = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (isSlash || isModK) {
        event.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Move focus into the modal on open, and back to the trigger on close.
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed === "" || status === "loading") return;

    setStatus("loading");
    setAnswer(null);
    setSources([]);
    setDegraded(undefined);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (res.status === 429) {
        setStatus("rate-limited");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data: AskResponse = await res.json();
      setSources(data.sources ?? []);
      if (typeof data.answer === "string") {
        setAnswer(data.answer);
        setStatus("answer");
      } else if (data.sources && data.sources.length > 0) {
        setDegraded(data.degraded);
        setStatus("degraded");
      } else {
        // Nothing matched, which is an answer of its own, not a failure.
        setStatus("no-match");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="Search the docs"
        onClick={() => setIsOpen(true)}
      >
        <span className={styles.triggerLabel}>Search</span>
        <span className={styles.triggerShortcut}>/</span>
      </button>

      {isOpen && (
        <div className={styles.backdrop} onClick={handleBackdropClick}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Search the docs">
            <form className={styles.form} onSubmit={submit}>
              <input
                ref={inputRef}
                type="text"
                className={styles.input}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={MAX_QUESTION_LENGTH}
                placeholder="Ask a question about Kokio"
                aria-label="Question"
              />
              <button
                type="submit"
                className={styles.submit}
                disabled={status === "loading" || question.trim() === ""}
              >
                {status === "loading" ? "Asking…" : "Ask"}
              </button>
            </form>

            <div className={styles.results}>
              {status === "loading" && <p className={styles.status}>Thinking…</p>}

              {status === "rate-limited" && (
                <p className={styles.status}>Too many questions at once. Wait a moment and try again.</p>
              )}

              {status === "error" && (
                <p className={styles.status}>Something went wrong. Try again in a moment.</p>
              )}

              {status === "no-match" && (
                <p className={styles.status}>
                  Nothing in the docs matches that. Try naming the contract, the
                  screen or the term you are after.
                </p>
              )}

              {status === "answer" && answer !== null && (
                <div className={styles.answer}>
                  {parseAnswer(answer).map((block, index) =>
                    block.type === "p" ? (
                      <p key={index}>{block.text}</p>
                    ) : (
                      <ul key={index}>
                        {block.items.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                  {sources.length > 0 && (
                    <>
                      <p className={styles.sourcesHeading}>Read more</p>
                      <SourceList sources={sources} />
                    </>
                  )}
                </div>
              )}

              {status === "degraded" && (
                <div className={styles.answer}>
                  <p className={styles.status}>
                    {degraded === "quota"
                      ? "Answers have hit their daily limit."
                      : "Answers are unavailable right now."}
                  </p>
                  <p className={styles.sourcesHeading}>Pages that mention this</p>
                  <SourceList sources={sources} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SourceList({ sources }: { sources: Source[] }): React.ReactElement {
  return (
    <ul className={styles.sourcesList}>
      {sources.map((source) => (
        <li key={source.url}>
          <Link to={source.url}>{source.title}</Link>
        </li>
      ))}
    </ul>
  );
}
