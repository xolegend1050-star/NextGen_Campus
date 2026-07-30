import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib
import os

class DropoutPredictor:
    def __init__(self):
        self.model = None
        self.model_path = 'models/saved/dropout_model.pkl'
        
        if os.path.exists(self.model_path):
            self.load_model()
        else:
            self.create_dummy_model()
    
    def create_dummy_model(self):
        """Create a simple model for demonstration"""
        self.model = RandomForestClassifier(n_estimators=50, random_state=42)
        
        # Generate synthetic training data
        X_train = np.random.rand(500, 6)
        y_train = np.random.randint(0, 2, 500)
        
        self.model.fit(X_train, y_train)
        
        os.makedirs('models/saved', exist_ok=True)
        joblib.dump(self.model, self.model_path)
    
    def load_model(self):
        """Load saved model"""
        self.model = joblib.load(self.model_path)
    
    def extract_features(self, activity_data):
        """Extract features from activity data"""
        features = []
        
        # Login frequency (last 30 days)
        features.append(activity_data.get('login_frequency', 0))
        
        # Doubt activity
        features.append(activity_data.get('doubts_asked', 0))
        features.append(activity_data.get('answers_given', 0))
        
        # Mentorship activity
        features.append(activity_data.get('sessions_attended', 0))
        
        # Gig activity
        features.append(activity_data.get('gigs_applied', 0))
        features.append(activity_data.get('gigs_completed', 0))
        
        return np.array(features).reshape(1, -1)
    
    def predict(self, student_id, activity_data):
        """Predict dropout risk"""
        try:
            features = self.extract_features(activity_data)
            
            # Get prediction probability
            prob = self.model.predict_proba(features)[0][1]
            
            # Determine risk level
            if prob > 0.7:
                risk_level = 'high'
                action = 'Send re-engagement email with personalized recommendations'
            elif prob > 0.4:
                risk_level = 'medium'
                action = 'Show motivational content and success stories'
            else:
                risk_level = 'low'
                action = 'Continue normal engagement'
            
            return {
                'dropout_probability': round(prob * 100),
                'risk_level': risk_level,
                'recommended_action': action,
                'engagement_score': round((1 - prob) * 100)
            }
            
        except Exception as e:
            return {
                'dropout_probability': 50,
                'risk_level': 'medium',
                'recommended_action': 'Monitor activity',
                'engagement_score': 50
            }
