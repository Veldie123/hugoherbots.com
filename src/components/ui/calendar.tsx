"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, DayContentProps, DayPickerSingleProps } from "react-day-picker";
import { nl } from "date-fns/locale";

import { cn } from "./utils";
import { buttonVariants } from "./button";

type CalendarProps = Omit<DayPickerSingleProps, 'mode'> & {
  mode?: 'single';
  sessionDates?: Date[];
  sessionIndicatorColor?: string;
  selectedDayColor?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  sessionDates = [],
  sessionIndicatorColor = "bg-purple-600",
  selectedDayColor = "bg-primary",
  weekStartsOn = 1,
  selected,
  onSelect,
  ...props
}: CalendarProps) {
  const hasSessionOnDate = React.useCallback((date: Date) => {
    return sessionDates.some(sessionDate => 
      sessionDate.getFullYear() === date.getFullYear() &&
      sessionDate.getMonth() === date.getMonth() &&
      sessionDate.getDate() === date.getDate()
    );
  }, [sessionDates]);

  const CustomDayContent = React.useMemo(() => {
    return function DayContent(contentProps: DayContentProps) {
      const { date } = contentProps;
      const hasSession = hasSessionOnDate(date);
      const isSelected = selected instanceof Date && 
        selected.getFullYear() === date.getFullYear() &&
        selected.getMonth() === date.getMonth() &&
        selected.getDate() === date.getDate();

      const indicatorStyle: React.CSSProperties = {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: isSelected ? '#ffffff' : (sessionIndicatorColor === 'bg-hh-primary' ? '#1e3a5f' : '#9333ea'),
        marginTop: '2px'
      };

      return (
        <div className="relative flex flex-col items-center justify-center w-full h-full pb-1">
          <span>{date.getDate()}</span>
          {hasSession && (
            <span style={indicatorStyle} />
          )}
        </div>
      );
    };
  }, [hasSessionOnDate, selected, sessionIndicatorColor]);

  return (
    <DayPicker
      mode="single"
      showOutsideDays={showOutsideDays}
      selected={selected}
      onSelect={onSelect}
      locale={nl}
      weekStartsOn={weekStartsOn}
      className={cn("p-1 w-full", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-1 w-full",
        month: "flex flex-col gap-3 w-full",
        caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-base font-semibold",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell:
          "text-muted-foreground rounded-md font-medium text-[0.8rem] flex-1 text-center py-1",
        row: "flex w-full mt-0.5",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1 flex items-center justify-center [&:has([aria-selected])]:rounded-md",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal aria-selected:opacity-100 text-[14px]",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          `${selectedDayColor} text-primary-foreground hover:${selectedDayColor} hover:text-primary-foreground focus:${selectedDayColor} focus:text-primary-foreground`,
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        DayContent: CustomDayContent,
        IconLeft: ({ className: iconClassName, ...iconProps }) => (
          <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
        ),
        IconRight: ({ className: iconClassName, ...iconProps }) => (
          <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
