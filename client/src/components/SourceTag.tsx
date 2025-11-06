import { isProvEnabled } from "@/lib/provenance";

interface SourceTagProps {
  src: 'user' | 'local' | 'api' | 'static' | 'url' | 'computed';
  className?: string;
}

export const SourceTag = ({ src, className = "" }: SourceTagProps) => {
  if (!isProvEnabled()) return null;

  const colors = {
    user: 'bg-purple-100 text-purple-700 border-purple-200',
    local: 'bg-green-100 text-green-700 border-green-200', 
    api: 'bg-blue-100 text-blue-700 border-blue-200',
    static: 'bg-gray-100 text-gray-700 border-gray-200',
    url: 'bg-orange-100 text-orange-700 border-orange-200',
    computed: 'bg-yellow-100 text-yellow-700 border-yellow-200'
  };

  return (
    <span className={`px-1 py-0.5 rounded text-xs border opacity-70 ${colors[src]} ${className}`}>
      {src}
    </span>
  );
};