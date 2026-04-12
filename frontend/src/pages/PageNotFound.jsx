import { Link } from 'react-router-dom';

const PageNotFound = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
            <h1 className="text-9xl font-bold text-gray-200">404</h1>
            <h2 className="text-2xl font-semibold text-gray-900 mt-4">Page Not Found</h2>
            <p className="text-gray-500 mt-2 mb-8">The page you're looking for doesn't exist or has been moved.</p>
            <Link to="/" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition">
                Go to Dashboard
            </Link>
        </div>
    </div>
);

export default PageNotFound;
