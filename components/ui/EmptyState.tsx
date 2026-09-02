/**
 * Empty and failed states say what happened and what to do about it.
 * No apologies, no shrugging illustrations.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="gutter-x grid min-h-[60svh] place-items-center">
      <div className="max-w-[42ch] text-center">
        <h2 className="font-display text-title font-bold text-paper">{title}</h2>
        <p className="mt-2 text-body text-haze">{body}</p>
        {action && <div className="mt-6 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
