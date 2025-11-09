import { CheckCircle2, Loader2 } from "lucide-react";
import { Progress } from "./ui/progress";

interface ConversionProgressProps {
  total: number;
  completed: number;
  current?: string;
}

export const ConversionProgress = ({ total, completed, current }: ConversionProgressProps) => {
  const percentage = (completed / total) * 100;
  
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {completed === total ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          )}
          <div>
            <p className="font-medium">
              {completed === total ? 'Conversion Complete' : 'Converting Stickers'}
            </p>
            <p className="text-sm text-muted-foreground">
              {completed} of {total} files
            </p>
          </div>
        </div>
        <span className="text-2xl font-bold text-primary">{Math.round(percentage)}%</span>
      </div>
      
      <Progress value={percentage} className="h-2" />
      
      {current && completed < total && (
        <p className="text-sm text-muted-foreground">
          Processing: {current}
        </p>
      )}
    </div>
  );
};
