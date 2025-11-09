/**
 * Case Queue - Main Landing Page
 * Beautiful Lurie Children's Hospital branded design from v0
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Clock, User, FileText, Calendar, TrendingUp } from 'lucide-react';

// Sample pending cases
const SAMPLE_CASES = [
  {
    id: 'case_sch_001',
    mrn: '12345-67',
    age: 6,
    metricCode: 'I25',
    metricName: 'SCH Fracture < 18 hrs',
    domain: 'Timeliness',
    priority: 'high',
    arrivedAt: '2h ago',
    estimatedTime: '~7 min',
    borderColor: 'border-l-red-500',
    badgeVariant: 'secondary',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    timeClass: 'text-red-600',
    timeIconClass: 'text-red-500'
  },
  {
    id: 'case_openfx_004',
    mrn: '45678-90',
    age: 28,
    metricCode: 'I26',
    metricName: 'Open Fracture < 24 hrs',
    domain: 'Timeliness',
    priority: 'high',
    arrivedAt: '4h ago',
    estimatedTime: '~8 min',
    borderColor: 'border-l-red-500',
    badgeVariant: 'secondary',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    timeClass: 'text-orange-600',
    timeIconClass: 'text-orange-500'
  },
  {
    id: 'case_ssi_002',
    mrn: '23456-78',
    age: 45,
    metricCode: 'S12',
    metricName: 'SSI Assessment',
    domain: 'Safety',
    priority: 'normal',
    arrivedAt: '1d ago',
    estimatedTime: '~5 min',
    borderColor: 'border-l-blue-500',
    badgeVariant: 'secondary',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    timeClass: 'text-blue-600',
    timeIconClass: 'text-blue-500'
  },
  {
    id: 'case_rto_003',
    mrn: '34567-89',
    age: 32,
    metricCode: 'O21',
    metricName: 'Unplanned Return to OR',
    domain: 'Outcomes',
    priority: 'normal',
    arrivedAt: '3d ago',
    estimatedTime: '~6 min',
    borderColor: 'border-l-blue-500',
    badgeVariant: 'secondary',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    timeClass: 'text-teal-600',
    timeIconClass: 'text-teal-500'
  }
];

const SAMPLE_DRAFT = {
  id: 'case_draft_001',
  mrn: '56789-01',
  metricCode: 'I25',
  metricName: 'SCH Fracture < 18 hrs',
  startedAt: '45m ago',
  progress: 60
};

export default function CaseQueue() {
  const [, navigate] = useLocation();
  const [domain, setDomain] = useState('All Domains');
  const [priority, setPriority] = useState('All Priorities');

  const stats = {
    completed: 8,
    minutes: 62,
    avgTime: 7.8,
  };

  const highPriorityCases = SAMPLE_CASES.filter(c => c.priority === 'high');
  const normalPriorityCases = SAMPLE_CASES.filter(c => c.priority === 'normal');
  const totalEstimatedMinutes = SAMPLE_CASES.reduce((sum, c) => {
    return sum + parseInt(c.estimatedTime.replace(/[^0-9]/g, ''));
  }, 0);

  const startReview = (caseId: string) => {
    navigate(`/case/${caseId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lurie-cream via-background to-lurie-sky">
      <main className="container mx-auto px-6 py-8 max-w-7xl pt-6">
        {/* Page Title & Stats */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-1">Clinical Case Review Queue</h2>
              <p className="text-muted-foreground">AI-assisted case review for {specialty}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-foreground border-lurie-purple/30">
                <span className="font-semibold text-lg">{SAMPLE_CASES.length}</span>
                <span className="ml-1.5">cases pending</span>
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                ~{totalEstimatedMinutes} min estimated
              </Badge>
            </div>
          </div>

          {/* Completed Today - Compact Stats */}
          <Card className="bg-gradient-to-r from-lurie-purple/5 via-lurie-sky/5 to-lurie-purple/5 border-lurie-purple/20">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-lurie-purple/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-lurie-purple" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Completed Today</p>
                      <div className="flex items-baseline gap-4">
                        <div>
                          <span className="text-2xl font-bold text-lurie-purple">{stats.completed}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">cases</span>
                        </div>
                        <div>
                          <span className="text-2xl font-bold text-lurie-sky">{stats.minutes}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">total minutes</span>
                        </div>
                        <div>
                          <span className="text-2xl font-bold text-lurie-teal">{stats.avgTime}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">avg min/case</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-lurie-purple">
                  View History →
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="Domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Domains">All Domains</SelectItem>
              <SelectItem value="Timeliness">Timeliness</SelectItem>
              <SelectItem value="Safety">Safety</SelectItem>
              <SelectItem value="Outcomes">Outcomes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Priorities">All Priorities</SelectItem>
              <SelectItem value="High">High Priority</SelectItem>
              <SelectItem value="Normal">Normal Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* High Priority Cases */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-lg font-semibold text-foreground">HIGH PRIORITY</h3>
            <Badge variant="destructive" className="ml-2">
              {highPriorityCases.length}
            </Badge>
          </div>

          <div className="space-y-4">
            {highPriorityCases.map((c) => (
              <Card
                key={c.id}
                className={`${c.borderColor} border-l-4 hover:shadow-lg transition-all duration-200 bg-white`}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-lg font-bold text-foreground">MRN: {c.mrn}</h4>
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.metricCode}
                        </Badge>
                        <Badge variant={c.badgeVariant as any} className={c.badgeClass}>
                          {c.metricName}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          <span>{c.age}yo</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4" />
                          <span>{c.domain}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          <span>Arrived: {c.arrivedAt}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className={`h-4 w-4 ${c.timeIconClass}`} />
                          <span className={`font-medium ${c.timeClass}`}>
                            Est. Time: {c.estimatedTime}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => startReview(c.id)}
                      className="bg-lurie-purple hover:bg-lurie-purple/90 text-white shadow-md"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start AI Review
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Normal Priority Cases */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h3 className="text-lg font-semibold text-foreground">NORMAL PRIORITY</h3>
            <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700">
              {normalPriorityCases.length}
            </Badge>
          </div>

          <div className="space-y-4">
            {normalPriorityCases.map((c) => (
              <Card
                key={c.id}
                className={`${c.borderColor} border-l-4 hover:shadow-lg transition-all duration-200 bg-white`}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-lg font-bold text-foreground">MRN: {c.mrn}</h4>
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.metricCode}
                        </Badge>
                        <Badge variant={c.badgeVariant as any} className={c.badgeClass}>
                          {c.metricName}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          <span>{c.age}yo</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4" />
                          <span>{c.domain}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          <span>Arrived: {c.arrivedAt}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className={`h-4 w-4 ${c.timeIconClass}`} />
                          <span className={`font-medium ${c.timeClass}`}>
                            Est. Time: {c.estimatedTime}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => startReview(c.id)}
                      variant="outline"
                      className="border-lurie-purple text-lurie-purple hover:bg-lurie-purple/10 bg-transparent"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start AI Review
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* My Drafts */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <h3 className="text-lg font-semibold text-foreground">MY DRAFTS</h3>
            <Badge variant="secondary" className="ml-2 bg-amber-50 text-amber-700">
              1
            </Badge>
          </div>

          <Card className="border-l-4 border-l-amber-500 bg-white hover:shadow-lg transition-all duration-200">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-lg font-bold text-foreground">MRN: {SAMPLE_DRAFT.mrn}</h4>
                    <Badge variant="outline" className="font-mono text-xs">
                      {SAMPLE_DRAFT.metricCode}
                    </Badge>
                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                      {SAMPLE_DRAFT.metricName}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>Started: {SAMPLE_DRAFT.startedAt}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" />
                      <span className="font-medium">Progress: {SAMPLE_DRAFT.progress}%</span>
                    </div>
                    <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-lurie-purple rounded-full"
                        style={{ width: `${SAMPLE_DRAFT.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => startReview(SAMPLE_DRAFT.id)}
                    className="bg-lurie-purple hover:bg-lurie-purple/90 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                  <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
