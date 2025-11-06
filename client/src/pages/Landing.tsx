import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-[#007DC3] to-[#00A9E0] bg-clip-text text-transparent">
              USNWR Abstraction Helper
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Advanced medical record abstraction platform for healthcare quality review with AI-powered analysis and signal validation
            </p>
          </div>

          {/* Key Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
              <div className="w-12 h-12 bg-[#007DC3] rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Medical Record Analysis</h3>
              <p className="text-gray-600 dark:text-gray-300">Comprehensive pediatric medical record abstraction across multiple specialties</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
              <div className="w-12 h-12 bg-[#007DC3] rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">AI-Powered Inference</h3>
              <p className="text-gray-600 dark:text-gray-300">Real-time LLM analysis with GPT-4o for intelligent data interpretation</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
              <div className="w-12 h-12 bg-[#007DC3] rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Signal Validation</h3>
              <p className="text-gray-600 dark:text-gray-300">Advanced validation layers with CDC/NHSN compliance checking</p>
            </div>
          </div>

          {/* Lurie Children's Hospital Branding */}
          <div className="mb-12">
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
              Developed for <span className="font-semibold text-[#007DC3]">Lurie Children's Hospital</span> healthcare quality review teams
            </p>
          </div>

          {/* Login Button */}
          <div className="space-y-4">
            <Button 
              onClick={() => window.location.href = "/api/login"}
              className="bg-[#007DC3] hover:bg-[#005a9b] text-white px-8 py-3 text-lg font-medium rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl"
              data-testid="button-login"
            >
              Sign In to Access Platform
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Secure authentication required for patient data access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}