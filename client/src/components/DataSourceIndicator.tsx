interface DataSourceIndicatorProps {
  source: 'api' | 'localStorage' | 'cache' | 'computed' | 'static';
  children: React.ReactNode;
  className?: string;
}

const DataSourceIndicator = ({ source, children, className = "" }: DataSourceIndicatorProps) => {
  // For testing - always show indicators in development
  if (import.meta.env.PROD) {
    return <>{children}</>;
  }

  const colors = {
    api: 'border-l-blue-500',
    localStorage: 'border-l-green-500', 
    cache: 'border-l-yellow-500',
    computed: 'border-l-purple-500',
    static: 'border-l-gray-500'
  };

  const labels = {
    api: 'API',
    localStorage: 'Stored',
    cache: 'Cache',
    computed: 'Computed',
    static: 'Static'
  };

  return (
    <div className={`border-l-4 ${colors[source]} ${className} relative`}>
      <span className="absolute -top-1 -right-1 text-xs bg-gray-800 text-white px-1 rounded text-[10px] opacity-75">
        {labels[source]}
      </span>
      {children}
    </div>
  );
};

export default DataSourceIndicator;