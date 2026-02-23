import { Check } from "lucide-react";

interface CustomCheckboxProps {
  checked: boolean;
  onChange: () => void;
  onClick?: (e: React.MouseEvent) => void;
}

export function CustomCheckbox({ checked, onChange, onClick }: CustomCheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    onClick?.(e);
    onChange();
  };

  return (
    <div
      className="relative w-4 h-4 cursor-pointer"
      onClick={handleClick}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
      />
      
      <div
        className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
          checked
            ? 'border-purple-600 bg-purple-600'
            : 'border-slate-300 bg-white hover:border-purple-400'
        }`}
      >
        {checked && (
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        )}
      </div>
    </div>
  );
}
