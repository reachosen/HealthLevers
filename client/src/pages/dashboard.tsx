/**
 * Dashboard - New Main Landing Page
 */

import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Clock,
  TrendingUp,
  Brain,
  ArrowRight,
  Zap,
  CheckCircle2,
  Target
} from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function Dashboard() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Navbar />

      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Diagnostic Banner */}
        <div className="bg-green-500 text-white p-4 rounded-lg mb-8 text-center font-bold text-xl">
          ✅ NEW DASHBOARD LOADED SUCCESSFULLY! ✅
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-6">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">AI-Powered Clinical Abstraction</span>
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to <span className="text-blue-600">HealthLevers</span>
          </h1>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Intelligent clinical reasoning that reduces abstraction time from 30 minutes to 5 minutes
            while improving accuracy from 85% to 95%+
          </p>

          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate('/review-workbench')}
              className="gap-2 text-lg px-8 py-6 bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
            >
              <Brain className="h-5 w-5" />
              Launch AI Review Workbench
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card className="border-2 border-green-200 bg-green-50/50 hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl">5-7 Minutes</CardTitle>
              <CardDescription>Average review time (vs 30+ min manual)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                AI extracts the critical 20% from 500+ line JSON payloads, giving you instant
                clinical understanding
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-blue-50/50 hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">95%+ Accuracy</CardTitle>
              <CardDescription>Structured validation with AI assistance</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Dynamic reasoning questions guide you through Rule In/Out decisions with
                evidence-based confidence
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 bg-purple-50/50 hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl">AI-Assisted</CardTitle>
              <CardDescription>You decide, AI supports</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                AI suggests answers with confidence scores, but you maintain full clinical
                judgment and final decision authority
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="mb-16 border-2">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Zap className="h-6 w-6 text-blue-600" />
              How the AI Review Workflow Works
            </CardTitle>
            <CardDescription className="text-base">
              Three-layer intelligent abstraction in under 7 minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">📊 Clinical Summary</h3>
                <p className="text-sm text-gray-600 mb-4">
                  AI extracts critical 20%: Patient, Presentation, Assessment, Timeline
                </p>
                <Badge variant="secondary">10 seconds to read</Badge>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-600">2</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">🤖 Reasoning Questions</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Dynamic questions: Rule In, Rule Out, Clinical Insight
                </p>
                <Badge variant="secondary">3-4 minutes</Badge>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-600">3</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">⚖️ Final Decision</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Review evidence, make judgment, submit with confidence
                </p>
                <Badge variant="secondary">1-2 minutes</Badge>
              </div>
            </div>

            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 mb-1">Evidence-Based Every Step</p>
                  <p className="text-sm text-green-700">
                    Every summary point and question is backed by citations to specific JSON paths
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 mb-12">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Target className="h-6 w-6 text-blue-600" />
              Ready to Get Started?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Click "Launch AI Review Workbench"</h4>
                  <p className="text-sm text-gray-600">
                    Load with a sample supracondylar fracture case (ORTHO_I25)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Review AI-Generated Summary</h4>
                  <p className="text-sm text-gray-600">
                    6yo with SCH fracture, 8.5hr to OR, NPO delay justified
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Answer Reasoning Questions</h4>
                  <p className="text-sm text-gray-600">
                    Guide through inclusion, exclusion, and clinical insight questions
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  4
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Make Final Decision & Submit</h4>
                  <p className="text-sm text-gray-600">
                    Include/Exclude the case, add notes, and submit
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t mt-6">
                <Button
                  size="lg"
                  onClick={() => navigate('/review-workbench')}
                  className="w-full gap-2 text-lg py-6 bg-blue-600 hover:bg-blue-700"
                >
                  <Sparkles className="h-5 w-5" />
                  Launch AI Review Workbench Now
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-600 mb-1">5-7min</div>
              <div className="text-sm text-gray-600">Avg Review Time</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-green-600 mb-1">95%+</div>
              <div className="text-sm text-gray-600">Accuracy Rate</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-600 mb-1">80%</div>
              <div className="text-sm text-gray-600">Time Saved</div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-orange-600 mb-1">100+</div>
              <div className="text-sm text-gray-600">Quality Metrics</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
