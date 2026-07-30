import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
import os

class GigSuccessPredictor:
    def __init__(self):
        self.model = None
        self.label_encoders = {}
        self.model_path = 'models/saved/gig_success_model.pkl'
        
        # Try to load existing model
        if os.path.exists(self.model_path):
            self.load_model()
        else:
            self.create_dummy_model()
    
    def create_dummy_model(self):
        """Create a simple model for demonstration"""
        # Create a simple random forest classifier
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        
        # Generate synthetic training data
        X_train = np.random.rand(1000, 8)
        y_train = np.random.randint(0, 2, 1000)
        
        self.model.fit(X_train, y_train)
        
        # Save model
        os.makedirs('models/saved', exist_ok=True)
        joblib.dump(self.model, self.model_path)
    
    def load_model(self):
        """Load saved model"""
        self.model = joblib.load(self.model_path)
    
    def extract_features(self, gig, student_profile, current_applications):
        """Extract features for prediction"""
        features = []
        
        # Student features
        features.append(len(student_profile.get('skills', [])))
        features.append(float(student_profile.get('trust_score', 0)))
        features.append(1 if student_profile.get('talent_tier') == 'featured' else 0)
        
        # Gig features
        features.append(float(gig.get('compensation', 0)) / 1000)
        features.append(gig.get('duration_days', 7))
        features.append(1 if gig.get('is_remote', True) else 0)
        
        # Competition features
        features.append(current_applications)
        
        # Skill match
        student_skills = set(student_profile.get('skills', []))
        gig_skills = set(gig.get('skills_required', []))
        skill_match = len(student_skills.intersection(gig_skills)) / max(len(gig_skills), 1)
        features.append(skill_match)
        
        return np.array(features).reshape(1, -1)
    
    def predict(self, gig, student_profile, current_applications):
        """Predict gig success probability"""
        try:
            features = self.extract_features(gig, student_profile, current_applications)
            
            # Get prediction probability
            prob = self.model.predict_proba(features)[0][1]
            
            # Calculate confidence
            confidence = 'high' if prob > 0.7 or prob < 0.3 else 'medium' if prob > 0.5 or prob < 0.5 else 'low'
            
            # Identify skill gaps
            student_skills = set(student_profile.get('skills', []))
            gig_skills = set(gig.get('skills_required', []))
            skill_gaps = list(gig_skills - student_skills)
            matching_skills = list(student_skills.intersection(gig_skills))
            
            # Generate recommendation
            if prob > 0.7:
                recommendation = 'high'
                reason = 'Strong skill match and good profile'
            elif prob > 0.4:
                recommendation = 'medium'
                reason = 'Decent match, consider improving skills'
            else:
                recommendation = 'low'
                reason = 'Consider building more relevant skills first'
            
            return {
                'success_chance': round(prob * 100),
                'confidence': confidence,
                'matching_skills': matching_skills,
                'skill_gaps': skill_gaps,
                'recommendation': recommendation,
                'reason': reason
            }
            
        except Exception as e:
            # Fallback to simple calculation
            student_skills = set(student_profile.get('skills', []))
            gig_skills = set(gig.get('skills_required', []))
            matching = len(student_skills.intersection(gig_skills))
            total = max(len(gig_skills), 1)
            
            return {
                'success_chance': min(95, int((matching / total) * 100)),
                'confidence': 'low',
                'matching_skills': list(student_skills.intersection(gig_skills)),
                'skill_gaps': list(gig_skills - student_skills),
                'recommendation': 'medium',
                'reason': 'Based on skill match only'
            }
