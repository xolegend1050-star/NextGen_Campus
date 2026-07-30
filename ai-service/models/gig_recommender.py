import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
import joblib
import os
import json


class GigRecommender:
    def __init__(self):
        self.skill_vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(2, 4), max_features=500)
        self.category_encoder = LabelEncoder()
        self.scaler = MinMaxScaler()
        self.success_model = None
        self.interaction_matrix = None  # student x gig matrix for collaborative filtering
        self.student_ids = []
        self.gig_ids = []
        self.model_path = 'models/saved/gig_recommender_model.pkl'
        self.vectorizer_path = 'models/saved/gig_recommender_vectorizer.pkl'

        if os.path.exists(self.model_path):
            self._load_model()
        else:
            self._create_dummy_model()

    def _create_dummy_model(self):
        """Create models with synthetic training data"""
        self.success_model = GradientBoostingClassifier(
            n_estimators=150, max_depth=5, learning_rate=0.1, random_state=42
        )

        n_samples = 2000
        n_features = 7

        X_train = np.random.rand(n_samples, n_features)
        y_train = np.random.randint(0, 2, n_samples)

        self.success_model.fit(X_train, y_train)
        self.scaler.fit(X_train)

        self._build_interaction_matrix()

        os.makedirs('models/saved', exist_ok=True)
        self._save_model()

    def _build_interaction_matrix(self):
        """Build synthetic student-gig interaction matrix for collaborative filtering"""
        n_students = 50
        n_gigs = 30
        self.student_ids = [f'student_{i}' for i in range(n_students)]
        self.gig_ids = [f'gig_{i}' for i in range(n_gigs)]

        raw = np.random.rand(n_students, n_gigs)
        mask = np.random.choice([0, 1], size=(n_students, n_gigs), p=[0.7, 0.3])
        self.interaction_matrix = (raw * mask)

    def _save_model(self):
        joblib.dump({
            'success_model': self.success_model,
            'scaler': self.scaler,
            'category_encoder': self.category_encoder,
            'interaction_matrix': self.interaction_matrix,
            'student_ids': self.student_ids,
            'gig_ids': self.gig_ids,
        }, self.model_path)
        joblib.dump(self.skill_vectorizer, self.vectorizer_path)

    def _load_model(self):
        data = joblib.load(self.model_path)
        self.success_model = data['success_model']
        self.scaler = data['scaler']
        self.category_encoder = data['category_encoder']
        self.interaction_matrix = data.get('interaction_matrix')
        self.student_ids = data.get('student_ids', [])
        self.gig_ids = data.get('gig_ids', [])

        if os.path.exists(self.vectorizer_path):
            self.skill_vectorizer = joblib.load(self.vectorizer_path)

    def fit_skill_vectorizer(self, all_skill_texts):
        """Fit TF-IDF on corpus of skill strings. Call once during training."""
        self.skill_vectorizer.fit(all_skill_texts)

    def _skill_similarity(self, student_skills, gig_skills):
        """TF-IDF + cosine similarity between skill sets"""
        student_text = ' '.join(student_skills) if student_skills else ''
        gig_text = ' '.join(gig_skills) if gig_skills else ''

        if not student_text or not gig_text:
            return 0.0

        try:
            tfidf_matrix = self.skill_vectorizer.transform([student_text, gig_text])
            sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            return float(sim)
        except Exception:
            return 0.0

    def _skill_overlap_ratio(self, student_skills, gig_skills):
        """Jaccard-like overlap ratio"""
        s = set(student_skills or [])
        g = set(gig_skills or [])
        if not g:
            return 0.0
        return len(s & g) / len(g)

    def _collaborative_score(self, student_id, gig_id):
        """SVD-based collaborative filtering score"""
        if self.interaction_matrix is None:
            return 0.5

        if student_id in self.student_ids and gig_id in self.gig_ids:
            s_idx = self.student_ids.index(student_id)
            g_idx = self.gig_ids.index(gig_id)

            try:
                from numpy.linalg import svd
                U, sigma, Vt = svd(self.interaction_matrix, full_matrices=False)
                k = min(10, len(sigma))
                reconstructed = U[:, :k] @ np.diag(sigma[:k]) @ Vt[:k, :]
                score = reconstructed[s_idx, g_idx]
                return float(np.clip(score, 0, 1))
            except Exception:
                pass

        return 0.5

    def _extract_features(self, gig, student_profile, current_applications=0, student_id=None):
        """Extract feature vector for success prediction"""
        student_skills = student_profile.get('skills', [])
        gig_skills = gig.get('skills_required', [])

        skill_sim = self._skill_similarity(student_skills, gig_skills)
        overlap = self._skill_overlap_ratio(student_skills, gig_skills)

        trust = float(student_profile.get('trust_score', 0)) / 100.0
        compensation = float(gig.get('compensation', 0)) / 10000.0
        duration = float(gig.get('duration_days', 7)) / 30.0
        is_remote = 1.0 if gig.get('is_remote', True) else 0.0

        collab = 0.5
        if student_id:
            gig_id = gig.get('id', '')
            collab = self._collaborative_score(str(student_id), str(gig_id))

        return np.array([skill_sim, overlap, trust, compensation, duration, is_remote, collab]).reshape(1, -1)

    def recommend(self, student_skills, trust_score, gigs=None, student_id=None):
        """Recommend gigs with full ML scoring pipeline"""
        if gigs is None:
            gigs = self._demo_gigs()

        student_profile = {
            'skills': student_skills,
            'trust_score': trust_score
        }

        recommendations = []

        for gig in gigs:
            features = self._extract_features(
                gig, student_profile,
                current_applications=0,
                student_id=student_id
            )

            scaled = self.scaler.transform(features)
            prob = self.success_model.predict_proba(scaled)[0][1]

            gig_skills = set(gig.get('skills_required', []))
            student_set = set(student_skills or [])
            matching = list(student_set & gig_skills)
            gaps = list(gig_skills - student_set)

            confidence = 'high' if prob > 0.7 or prob < 0.3 else 'medium'

            if prob > 0.7:
                recommendation = 'high'
                reason = 'Strong skill match with high success probability'
            elif prob > 0.4:
                recommendation = 'medium'
                reason = 'Decent match — building missing skills would help'
            else:
                recommendation = 'low'
                reason = 'Consider upskilling before applying'

            recommendations.append({
                'gig': gig,
                'score': round(prob * 100, 1),
                'confidence': confidence,
                'matching_skills': matching,
                'skill_gaps': gaps,
                'match_percentage': round((len(matching) / max(len(gig_skills), 1)) * 100),
                'recommendation': recommendation,
                'reason': reason
            })

        recommendations.sort(key=lambda x: x['score'], reverse=True)
        return recommendations[:10]

    def train_from_interactions(self, interactions):
        """
        Retrain the model from real interaction data.
        interactions: list of dicts with keys:
            student_skills, gig_skills, trust_score, compensation,
            duration_days, is_remote, applied (0/1), hired (0/1)
        """
        if len(interactions) < 50:
            return False

        X, y = [], []
        all_skill_texts = []

        for ix in interactions:
            student_skills = ix.get('student_skills', [])
            gig_skills = ix.get('gig_skills', [])
            all_skill_texts.append(' '.join(student_skills))
            all_skill_texts.append(' '.join(gig_skills))

        self.skill_vectorizer.fit(all_skill_texts)

        for ix in interactions:
            profile = {'skills': ix.get('student_skills', []), 'trust_score': ix.get('trust_score', 0)}
            gig = {
                'skills_required': ix.get('gig_skills', []),
                'compensation': ix.get('compensation', 0),
                'duration_days': ix.get('duration_days', 7),
                'is_remote': ix.get('is_remote', True),
                'id': ix.get('gig_id', '')
            }
            feat = self._extract_features(gig, profile, 0, ix.get('student_id'))
            X.append(feat[0])
            y.append(ix.get('hired', ix.get('applied', 0)))

        X = np.array(X)
        y = np.array(y)

        self.scaler.fit(X)
        X_scaled = self.scaler.transform(X)

        self.success_model.fit(X_scaled, y)
        self._save_model()
        return True

    @staticmethod
    def _demo_gigs():
        return [
            {
                'id': 'demo_1', 'title': 'React Frontend Developer',
                'skills_required': ['React', 'JavaScript', 'CSS', 'HTML'],
                'compensation': 5000, 'duration_days': 14,
                'category': 'Web Development', 'company': 'TechStart',
                'is_remote': True
            },
            {
                'id': 'demo_2', 'title': 'Python Data Analysis',
                'skills_required': ['Python', 'Pandas', 'SQL', 'NumPy'],
                'compensation': 8000, 'duration_days': 21,
                'category': 'Data Science', 'company': 'DataCo',
                'is_remote': True
            },
            {
                'id': 'demo_3', 'title': 'UI/UX Design Intern',
                'skills_required': ['Figma', 'UI Design', 'Prototyping'],
                'compensation': 4000, 'duration_days': 10,
                'category': 'Design', 'company': 'DesignHub',
                'is_remote': False
            },
            {
                'id': 'demo_4', 'title': 'Node.js Backend Developer',
                'skills_required': ['Node.js', 'Express', 'MongoDB', 'REST API'],
                'compensation': 6000, 'duration_days': 18,
                'category': 'Web Development', 'company': 'BackEnd Inc',
                'is_remote': True
            },
            {
                'id': 'demo_5', 'title': 'Machine Learning Intern',
                'skills_required': ['Python', 'TensorFlow', 'scikit-learn', 'Pandas'],
                'compensation': 10000, 'duration_days': 30,
                'category': 'AI/ML', 'company': 'AI Labs',
                'is_remote': True
            },
        ]
