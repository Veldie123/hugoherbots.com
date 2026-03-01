export function PageFooter() {
  return (
    <div className="mt-12 mb-4 px-4">
      <div className="border-t border-hh-ui-200 dark:border-hh-ui-700 pt-4 pb-2 flex items-center justify-center">
        <span className="text-xs text-hh-ui-400 dark:text-hh-ui-500">
          HugoHerbots.ai &copy; {new Date().getFullYear()}
        </span>
      </div>
    </div>
  );
}
