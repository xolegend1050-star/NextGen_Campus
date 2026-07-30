import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import {
  HandThumbUpIcon,
  HandThumbDownIcon,
  CheckIcon,
  ArrowLeftIcon,
  UserIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const DoubtDetail = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [doubt, setDoubt] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    fetchDoubt();
  }, [id]);

  const fetchDoubt = async () => {
    try {
      const [doubtRes, answersRes] = await Promise.all([
        api.get(`/doubts/${id}`),
        api.get(`/doubts/${id}/answers`)
      ]);
      setDoubt(doubtRes.data.doubt);
      setAnswers(answersRes.data.answers);
    } catch (error) {
      toast.error('Failed to load doubt');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (data) => {
    setSubmitting(true);
    try {
      await api.post(`/doubts/${id}/answers`, data);
      toast.success('Answer posted!');
      reset();
      fetchDoubt();
    } catch (error) {
      toast.error('Failed to post answer');
    } finally {
      setSubmitting(false);
    }
  };

  const voteDoubt = async (voteType) => {
    try {
      await api.post(`/doubts/${id}/vote`, { vote_type: voteType });
      fetchDoubt();
    } catch (error) {
      toast.error('Failed to vote');
    }
  };

  const voteAnswer = async (answerId, voteType) => {
    try {
      await api.post(`/doubts/answers/${answerId}/vote`, { vote_type: voteType });
      fetchDoubt();
    } catch (error) {
      toast.error('Failed to vote');
    }
  };

  const acceptAnswer = async (answerId) => {
    try {
      await api.post(`/doubts/${id}/accept/${answerId}`);
      toast.success('Answer accepted!');
      fetchDoubt();
    } catch (error) {
      toast.error('Failed to accept answer');
    }
  };

  if (loading) return <LoadingSpinner text="Loading doubt..." />;
  if (!doubt) return <div>Doubt not found</div>;

  const isAuthor = user?.id === doubt.author_id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link to="/dashboard/doubts" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Doubts
      </Link>

      {/* Question */}
      <div className="card">
        <div className="flex items-start gap-4">
          {/* Voting */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => voteDoubt(1)}
              className="p-2 rounded-lg hover:bg-primary-50 text-gray-500 hover:text-primary-600"
            >
              <HandThumbUpIcon className="h-6 w-6" />
            </button>
            <span className="text-xl font-semibold">{doubt.upvotes || 0}</span>
            <button
              onClick={() => voteDoubt(-1)}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
            >
              <HandThumbDownIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{doubt.title}</h1>
              <Badge
                variant={doubt.status === 'open' ? 'warning' : doubt.status === 'answered' ? 'success' : 'gray'}
              >
                {doubt.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <span>Asked by {doubt.author_name || 'Anonymous'}</span>
              <span>•</span>
              <span>{new Date(doubt.created_at).toLocaleDateString()}</span>
              <span>•</span>
              <span>{doubt.views} views</span>
            </div>

            <div className="mt-4 prose max-w-none text-gray-700">
              {doubt.content}
            </div>

            {doubt.tags && (
              <div className="flex flex-wrap gap-2 mt-4">
                {doubt.tags.map((tag) => (
                  <Badge key={tag} variant="gray">{tag}</Badge>
                ))}
              </div>
            )}

            {/* AI Draft Answer */}
            {doubt.ai_draft_answer && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <SparklesIcon className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">AI Draft Answer</span>
                  <Badge variant="info" size="xs">Generated instantly</Badge>
                </div>
                <div className="text-gray-700 whitespace-pre-wrap">
                  {doubt.ai_draft_answer}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Answers */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">
          {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
        </h2>

        {answers.length > 0 ? (
          <div className="space-y-4">
            {answers.map((answer) => (
              <div
                key={answer.id}
                className={`p-4 rounded-lg border ${
                  answer.is_accepted ? 'border-green-300 bg-green-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Voting */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => voteAnswer(answer.id, 1)}
                      className="p-1 rounded hover:bg-primary-50"
                    >
                      <HandThumbUpIcon className="h-5 w-5 text-gray-400" />
                    </button>
                    <span className="font-medium">{answer.upvotes || 0}</span>
                    <button
                      onClick={() => voteAnswer(answer.id, -1)}
                      className="p-1 rounded hover:bg-red-50"
                    >
                      <HandThumbDownIcon className="h-5 w-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <UserIcon className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="font-medium text-gray-900">
                        {answer.author_name || 'Anonymous'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(answer.created_at).toLocaleDateString()}
                      </span>
                      {answer.is_accepted && (
                        <Badge variant="success" size="sm">
                          <CheckIcon className="h-3 w-3 mr-1" />
                          Accepted
                        </Badge>
                      )}
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {answer.content}
                    </div>
                    {isAuthor && doubt.status !== 'closed' && !answer.is_accepted && (
                      <button
                        onClick={() => acceptAnswer(answer.id)}
                        className="mt-3 text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        Accept this answer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No answers yet. Be the first to help!
          </p>
        )}
      </div>

      {/* Post Answer */}
      {doubt.status !== 'closed' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Your Answer</h2>
          <form onSubmit={handleSubmit(submitAnswer)}>
            <textarea
              {...register('content', { required: 'Answer is required' })}
              rows={6}
              className={`input-field ${errors.content ? 'input-error' : ''}`}
              placeholder="Write your answer here..."
            />
            {errors.content && (
              <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
            )}
            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Posting...' : 'Post Answer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default DoubtDetail;
