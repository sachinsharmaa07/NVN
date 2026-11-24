/** One titled block in the style guide. h3 because each theme panel is an h2. */
export function StyleGuideSection({ title, children }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl">{title}</h3>
      {children}
    </div>
  );
}

/** A small caption above a row of examples. */
export function Caption({ children }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
