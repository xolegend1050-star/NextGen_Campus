import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_API_URL = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}'

# Import ML models
from models.gig_success_predictor import GigSuccessPredictor
from models.mentor_recommender import MentorRecommender
from models.gig_recommender import GigRecommender
from models.dropout_predictor import DropoutPredictor

# Initialize models
gig_predictor = GigSuccessPredictor()
mentor_recommender = MentorRecommender()
gig_recommender = GigRecommender()
dropout_predictor = DropoutPredictor()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'ai-service'})


@app.route('/api/generate-doubt-answer', methods=['POST'])
def generate_doubt_answer():
    """Generate AI draft answer for a doubt using Gemini API"""
    try:
        data = request.json
        title = data.get('title', '')
        content = data.get('content', '')
        tags = data.get('tags', [])
        subject = data.get('subject', '')

        prompt = f"""You are an expert tutor helping a college student. 
Answer this academic doubt clearly and accurately.

Title: {title}
Content: {content}
Subject: {subject}
Tags: {', '.join(tags)}

Provide a clear, step-by-step answer that a college student can understand. 
Include relevant examples if possible."""

        # Call Gemini API
        response = requests.post(
            GEMINI_API_URL,
            json={
                'contents': [{'parts': [{'text': prompt}]}]
            }
        )

        if response.status_code == 200:
            result = response.json()
            answer = result['candidates'][0]['content']['parts'][0]['text']
            return jsonify({'answer': answer, 'source': 'ai'})
        else:
            return jsonify({'error': 'AI service temporarily unavailable'}), 503

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/moderate-content', methods=['POST'])
def moderate_content():
    """Moderate content for toxicity"""
    try:
        data = request.json
        content = data.get('content', '')

        prompt = f"""Analyze this content for potential issues:
Content: {content}

Check for:
1. Toxicity or hate speech
2. Spam or promotional content
3. Harassment or bullying
4. Inappropriate language
5. Misinformation

Return a JSON response with:
- is_safe: boolean
- confidence: float (0-1)
- categories: list of detected issues
- suggestion: recommendation"""

        response = requests.post(
            GEMINI_API_URL,
            json={
                'contents': [{'parts': [{'text': prompt}]}]
            }
        )

        if response.status_code == 200:
            result = response.json()
            moderation_result = result['candidates'][0]['content']['parts'][0]['text']
            return jsonify({'result': moderation_result, 'is_safe': True})
        else:
            return jsonify({'is_safe': True, 'confidence': 0.5})

    except Exception as e:
        return jsonify({'is_safe': True, 'error': str(e)})


@app.route('/api/recommend-mentors', methods=['POST'])
def recommend_mentors():
    """Recommend mentors based on student profile"""
    try:
        data = request.json
        student_skills = data.get('student_skills', [])
        student_interests = data.get('student_interests', [])
        student_city = data.get('student_city', '')

        recommendations = mentor_recommender.recommend(
            student_skills=student_skills,
            student_interests=student_interests,
            student_city=student_city
        )

        return jsonify({'mentors': recommendations})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/recommend-gigs', methods=['POST'])
def recommend_gigs():
    """Recommend gigs based on student profile using ML model"""
    try:
        data = request.json
        student_skills = data.get('student_skills', [])
        trust_score = data.get('trust_score', 0)
        student_id = data.get('student_id', None)

        recommendations = gig_recommender.recommend(
            student_skills=student_skills,
            trust_score=trust_score,
            student_id=student_id
        )

        return jsonify({'gigs': recommendations})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict-gig-success', methods=['POST'])
def predict_gig_success():
    """Predict gig application success"""
    try:
        data = request.json
        gig = data.get('gig', {})
        student_profile = data.get('student_profile', {})
        current_applications = data.get('current_applications', 0)

        prediction = gig_predictor.predict(
            gig=gig,
            student_profile=student_profile,
            current_applications=current_applications
        )

        return jsonify({'prediction': prediction})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/analyze-resume', methods=['POST'])
def analyze_resume():
    """Analyze resume and identify skill gaps using Gemini API"""
    try:
        data = request.json
        resume_url = data.get('resume_url', '')
        student_id = data.get('student_id', '')

        prompt = f"""Analyze this resume/profile and provide career guidance.
Resume URL: {resume_url}

Provide a JSON response with:
1. skills_identified: list of skills found in the resume
2. skill_gaps: list of important skills missing for industry readiness
3. recommendations: list of 3-5 specific actionable recommendations
4. overall_score: a score from 0-100 based on resume quality and completeness

Return ONLY valid JSON, no markdown."""

        response = requests.post(
            GEMINI_API_URL,
            json={
                'contents': [{'parts': [{'text': prompt}]}]
            }
        )

        if response.status_code == 200:
            result = response.json()
            raw_text = result['candidates'][0]['content']['parts'][0]['text']
            # Try to parse JSON from the response
            import json
            import re
            # Extract JSON from potential markdown code blocks
            json_match = re.search(r'\{[\s\S]*\}', raw_text)
            if json_match:
                analysis = json.loads(json_match.group())
            else:
                analysis = {
                    'skills_identified': [],
                    'skill_gaps': [],
                    'recommendations': [raw_text],
                    'overall_score': 50
                }
            return jsonify({'analysis': analysis})
        else:
            # Fallback response
            analysis = {
                'skills_identified': ['Analysis temporarily unavailable'],
                'skill_gaps': [],
                'recommendations': ['Please try again later or upload your resume for manual review'],
                'overall_score': 0
            }
            return jsonify({'analysis': analysis})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/mock-interview', methods=['POST'])
def mock_interview():
    """Generate mock interview questions or evaluate an answer"""
    try:
        data = request.json
        role = data.get('role', 'Software Developer')
        skills = data.get('skills', [])
        question = data.get('question', '')
        student_answer = data.get('student_answer', '')

        # If question + student_answer provided, evaluate the answer
        if question and student_answer:
            prompt = f"""You are an experienced technical interviewer evaluating a candidate's answer.

Question: {question}
Candidate's Answer: {student_answer}

Provide constructive feedback with:
1. strengths: what the candidate did well
2. areas_for_improvement: what could be better
3. score: 0-100 rating
4. better_answer: an example of an ideal answer

Return ONLY valid JSON, no markdown."""

            response = requests.post(
                GEMINI_API_URL,
                json={
                    'contents': [{'parts': [{'text': prompt}]}]
                }
            )

            if response.status_code == 200:
                result = response.json()
                raw_text = result['candidates'][0]['content']['parts'][0]['text']
                import json
                import re
                json_match = re.search(r'\{[\s\S]*\}', raw_text)
                if json_match:
                    feedback_data = json.loads(json_match.group())
                    return jsonify({
                        'feedback': feedback_data.get('better_answer', raw_text),
                        'score': feedback_data.get('score', 50),
                        'details': feedback_data
                    })
                return jsonify({'feedback': raw_text, 'score': 50})
            else:
                return jsonify({'error': 'AI service unavailable'}), 503

        # Otherwise generate questions
        prompt = f"""Generate 5 mock interview questions for a {role} position.
Required skills: {', '.join(skills)}

Include:
1. Technical questions
2. Behavioral questions
3. Problem-solving questions

Return questions with expected answer guidelines."""

        response = requests.post(
            GEMINI_API_URL,
            json={
                'contents': [{'parts': [{'text': prompt}]}]
            }
        )

        if response.status_code == 200:
            result = response.json()
            questions = result['candidates'][0]['content']['parts'][0]['text']
            return jsonify({'questions': questions})
        else:
            return jsonify({'error': 'AI service unavailable'}), 503

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/train-gig-recommender', methods=['POST'])
def train_gig_recommender():
    """Retrain gig recommender with new interaction data"""
    try:
        data = request.json
        interactions = data.get('interactions', [])

        if len(interactions) < 50:
            return jsonify({'error': 'Need at least 50 interactions to retrain'}), 400

        success = gig_recommender.train_from_interactions(interactions)

        if success:
            return jsonify({'message': f'Model retrained on {len(interactions)} interactions'})
        else:
            return jsonify({'error': 'Training failed'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict-dropout', methods=['POST'])
def predict_dropout():
    """Predict student dropout risk"""
    try:
        data = request.json
        student_id = data.get('student_id', '')
        activity_data = data.get('activity_data', {})

        prediction = dropout_predictor.predict(
            student_id=student_id,
            activity_data=activity_data
        )

        return jsonify({'prediction': prediction})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict-payment-risk', methods=['POST'])
def predict_payment_risk():
    """Predict company payment risk"""
    try:
        data = request.json
        company_data = data.get('company_data', {})

        # Simple risk assessment
        risk_score = 0
        factors = []

        if company_data.get('is_verified', False):
            risk_score -= 20
            factors.append('Verified company')

        if company_data.get('trust_score', 0) > 50:
            risk_score -= 30
            factors.append('High trust score')

        if company_data.get('total_gigs_completed', 0) > 5:
            risk_score -= 20
            factors.append('Track record of completed gigs')

        risk_score = max(0, min(100, risk_score + 50))

        return jsonify({
            'risk_score': risk_score,
            'risk_level': 'low' if risk_score < 30 else 'medium' if risk_score < 60 else 'high',
            'factors': factors,
            'recommendation': 'Use escrow' if risk_score > 50 else 'Standard payment'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
