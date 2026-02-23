interface CoachingProps {
  navigate: (page: string) => void;
  isAdmin?: boolean;
}

export function Coaching({ navigate, isAdmin }: CoachingProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Coaching</h1>
        <p className="text-gray-600">Coaching features coming soon.</p>
        <button 
          onClick={() => navigate("dashboard")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
