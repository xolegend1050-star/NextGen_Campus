from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np

class MentorRecommender:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(stop_words='english')
    
    def recommend(self, student_skills, student_interests, student_city, mentors=None):
        """Recommend mentors based on student profile"""
        if mentors is None:
            # Demo mentors data
            mentors = [
                {
                    'id': '1',
                    'name': 'Priya Sharma',
                    'skills': ['Python', 'Machine Learning', 'Data Science'],
                    'city': 'Mumbai',
                    'company': 'Google',
                    'rating': 4.8,
                    'trust_score': 85
                },
                {
                    'id': '2',
                    'name': 'Rahul Patel',
                    'skills': ['React', 'Node.js', 'JavaScript'],
                    'city': 'Pune',
                    'company': 'Microsoft',
                    'rating': 4.6,
                    'trust_score': 78
                },
                {
                    'id': '3',
                    'name': 'Anjali Gupta',
                    'skills': ['Java', 'Spring Boot', 'Microservices'],
                    'city': 'Nashik',
                    'company': 'Amazon',
                    'rating': 4.9,
                    'trust_score': 92
                }
            ]
        
        # Calculate similarity scores
        recommendations = []
        
        for mentor in mentors:
            score = 0
            reasons = []
            
            # Skill match
            mentor_skills = set(mentor.get('skills', []))
            student_skills_set = set(student_skills)
            skill_overlap = len(mentor_skills.intersection(student_skills_set))
            
            if skill_overlap > 0:
                score += skill_overlap * 20
                reasons.append(f'Common skills: {", ".join(mentor_skills.intersection(student_skills_set))}')
            
            # City preference
            if mentor.get('city', '').lower() == student_city.lower():
                score += 15
                reasons.append('Same city')
            
            # Rating factor
            score += mentor.get('rating', 0) * 5
            
            # Trust score factor
            score += mentor.get('trust_score', 0) * 0.2
            
            recommendations.append({
                'mentor': mentor,
                'score': min(100, score),
                'reasons': reasons
            })
        
        # Sort by score
        recommendations.sort(key=lambda x: x['score'], reverse=True)
        
        return recommendations[:5]  # Return top 5
    
    def calculate_text_similarity(self, text1, text2):
        """Calculate similarity between two texts"""
        try:
            tfidf_matrix = self.vectorizer.fit_transform([text1, text2])
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
            return similarity[0][0]
        except:
            return 0.0
