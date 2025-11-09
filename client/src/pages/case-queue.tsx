/**
 * Case Queue - Main Landing Page
 *
 * Shows pending cases waiting for abstraction
 * Clinician workflow: Pick a case → Start AI Review → Submit → Next
 */

import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  FileText,
  TrendingUp,
  Play
} from 'lucide-react';

// Sample pending cases (in production, this would come from API)
const SAMPLE_CASES = [
  {
    id: 'case_sch_001',
    mrn: '12345-67',
    patientName: 'Patient A',
    age: 6,
    metricId: 'ORTHO_I25',
    metricName: 'SCH Fracture < 18 hrs',
    metricCode: 'I25',
    domain: 'Timeliness',
    priority: 'high',
    arrivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    estimatedTime: '~7 min',
    specialty: 'Orthopedics'
  },
  {
    id: 'case_ssi_002',
    mrn: '23456-78',
    patientName: 'Patient B',
    age: 45,
    metricId: 'ORTHO_S12',
    metricName: 'SSI Assessment',
    metricCode: 'S12',
    domain: 'Safety',
    priority: 'normal',
    arrivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    estimatedTime: '~5 min',
    specialty: 'Orthopedics'
  },
  {
    id: 'case_rto_003',
    mrn: '34567-89',
    patientName: 'Patient C',
    age: 32,
    metricId: 'ORTHO_O21',
    metricName: 'Unplanned Return to OR',
    metricCode: 'O21',
    domain: 'Outcomes',
    priority: 'normal',
    arrivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    estimatedTime: '~6 min',
    specialty: 'Orthopedics'
  },
  {
    id: 'case_openfx_004',
    mrn: '45678-90',
    patientName: 'Patient D',
    age: 28,
    metricId: 'ORTHO_I26',
    metricName: 'Open Fracture < 24 hrs',
    metricCode: 'I26',
    domain: 'Timeliness',
    priority: 'high',
    arrivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    estimatedTime: '~8 min',
    specialty: 'Orthopedics'
  }
];

// Sample draft cases (auto-saved in progress)
const SAMPLE_DRAFTS = [
  {
    id: 'case_draft_001',
    mrn: '56789-01',
    metricName: 'SCH Fracture < 18 hrs',
    metricCode: 'I25',
    startedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
    progress: 60
  }
];

// Today's completed cases
const COMPLETED_TODAY = {
  count: 8,
  totalMinutes: 62,
  avgMinutes: 7.8
};

export default function CaseQueue() {
  const [, navigate] = useLocation();
  const [selectedSpecialty, setSelectedSpecialty] = useState('Orthopedics');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const filteredCases = SAMPLE_CASES.filter(c => {
    if (filterDomain !== 'all' && c.domain !== filterDomain) return false;
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
    return true;
  });

  const highPriorityCases = filteredCases.filter(c => c.priority === 'high');
  const normalPriorityCases = filteredCases.filter(c => c.priority === 'normal');

  const totalEstimatedMinutes = filteredCases.reduce((sum, c) => {
    const mins = parseInt(c.estimatedTime.replace(/[^0-9]/g, ''));
    return sum + mins;
  }, 0);

  const formatTimeAgo = (date: Date) => {
    const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) {
      const mins = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
      return `${mins}m ago`;
    }
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'normal': return 'secondary';
      default: return 'outline';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'normal': return '🟡';
      default: return '⚪';
    }
  };

  const startReview = (caseId: string) => {
    navigate(`/case/${caseId}`);
  };

  const resumeDraft = (caseId: string) => {
    navigate(`/case/${caseId}`);
  };

  const discardDraft = (caseId: string) => {
    // In production, this would delete the draft from storage
    console.log('Discard draft:', caseId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📋 Abstraction Queue</h1>
              <p className="text-muted-foreground mt-1">
                AI-assisted case review for {selectedSpecialty}
              </p>
            </div>

            {/* Specialty Selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Specialty:</label>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="Orthopedics">Orthopedics</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Neurosurgery">Neurosurgery</option>
              </select>
            </div>
          </div>

          {/* Filters & Stats */}
          <div className="flex items-center justify-between bg-white rounded-lg border p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Domain:</label>
                <select
                  value={filterDomain}
                  onChange={(e) => setFilterDomain(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="all">All Domains</option>
                  <option value="Timeliness">Timeliness</option>
                  <option value="Safety">Safety</option>
                  <option value="Outcomes">Outcomes</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Priority:</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Only</option>
                  <option value="normal">Normal Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-sm">
                <span className="font-semibold text-gray-900">{filteredCases.length}</span>
                <span className="text-gray-600"> cases pending</span>
              </div>
              <div className="text-sm">
                <Clock className="inline h-4 w-4 mr-1 text-blue-600" />
                <span className="font-semibold text-gray-900">~{totalEstimatedMinutes} min</span>
                <span className="text-gray-600"> estimated</span>
              </div>
            </div>
          </div>
        </div>

        {/* High Priority Cases */}
        {highPriorityCases.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              🔴 HIGH PRIORITY
              <Badge variant="destructive">{highPriorityCases.length}</Badge>
            </h2>
            <div className="space-y-3">
              {highPriorityCases.map((c) => (
                <Card key={c.id} className="border-l-4 border-l-red-500 hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900">
                            MRN: {c.mrn}
                          </h3>
                          <Badge variant="outline">{c.metricCode}</Badge>
                          <span className="text-sm text-gray-600">{c.metricName}</span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{c.age}yo</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            <span>{c.domain}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>Arrived: {formatTimeAgo(c.arrivedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            <span>Est. Time: {c.estimatedTime}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => startReview(c.id)}
                        className="gap-2 bg-blue-600 hover:bg-blue-700"
                      >
                        <Play className="h-4 w-4" />
                        Start AI Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Normal Priority Cases */}
        {normalPriorityCases.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              🟡 NORMAL PRIORITY
              <Badge variant="secondary">{normalPriorityCases.length}</Badge>
            </h2>
            <div className="space-y-3">
              {normalPriorityCases.map((c) => (
                <Card key={c.id} className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900">
                            MRN: {c.mrn}
                          </h3>
                          <Badge variant="outline">{c.metricCode}</Badge>
                          <span className="text-sm text-gray-600">{c.metricName}</span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{c.age}yo</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            <span>{c.domain}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>Arrived: {formatTimeAgo(c.arrivedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            <span>Est. Time: {c.estimatedTime}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => startReview(c.id)}
                        className="gap-2"
                        variant="outline"
                      >
                        <Play className="h-4 w-4" />
                        Start AI Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Drafts Section */}
        {SAMPLE_DRAFTS.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              📁 MY DRAFTS
              <Badge variant="outline">{SAMPLE_DRAFTS.length}</Badge>
            </h2>
            <div className="space-y-3">
              {SAMPLE_DRAFTS.map((draft) => (
                <Card key={draft.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900">
                            MRN: {draft.mrn}
                          </h3>
                          <Badge variant="outline">{draft.metricCode}</Badge>
                          <span className="text-sm text-gray-600">{draft.metricName}</span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>Started: {formatTimeAgo(draft.startedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            <span>Progress: {draft.progress}%</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${draft.progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => resumeDraft(draft.id)}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Resume
                        </Button>
                        <Button
                          onClick={() => discardDraft(draft.id)}
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Discard
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Completed Today Section */}
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="h-5 w-5" />
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div>
                <div className="text-3xl font-bold text-green-900">{COMPLETED_TODAY.count}</div>
                <div className="text-sm text-green-700">cases completed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-900">{COMPLETED_TODAY.totalMinutes}</div>
                <div className="text-sm text-green-700">total minutes</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-900">{COMPLETED_TODAY.avgMinutes}</div>
                <div className="text-sm text-green-700">avg min/case</div>
              </div>
              <div className="ml-auto">
                <Button variant="outline" onClick={() => navigate('/completed')}>
                  View History →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {filteredCases.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                All caught up!
              </h3>
              <p className="text-gray-600">
                No pending cases in the queue. Great work!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
