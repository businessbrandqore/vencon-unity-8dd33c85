import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

const AddressTooltip = ({ address }: { address: string | null | undefined }) => {
  if (!address) return <span>—</span>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block truncate cursor-default">{address}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[350px] whitespace-normal">
          <p>{address}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AddressTooltip;
