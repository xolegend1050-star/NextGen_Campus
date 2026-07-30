"""
Training script for GigRecommender model.
Generates synthetic student-gig interaction data and trains the model.
Can also be used with real data from the database.

Usage:
    python train_gig_recommender.py              # Train with synthetic data
    python train_gig_recommender.py --real       # Train with real DB data (requires backend running)
"""

import sys
import os
import numpy as np
import json

sys.path.insert(0, os.path.dirname(__file__))

from models.gig_recommender import GigRecommender


SKILL_POOLS = {
    'web': ['React', 'JavaScript', 'HTML', 'CSS', 'Node.js', 'Express', 'TypeScript', 'Vue.js', 'Angular', 'Svelte', 'Tailwind CSS', 'REST API', 'GraphQL'],
    'data': ['Python', 'SQL', 'Pandas', 'NumPy', 'Tableau', 'Power BI', 'R', 'Excel', 'Statistics', 'A/B Testing'],
    'ml': ['Python', 'TensorFlow', 'PyTorch', 'scikit-learn', 'NLP', 'Computer Vision', 'Deep Learning', 'OpenCV', 'Keras'],
    'mobile': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Dart', 'iOS', 'Android'],
    'devops': ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux', 'Terraform', 'Jenkins', 'GitHub Actions'],
    'design': ['Figma', 'UI Design', 'UX Research', 'Prototyping', 'Adobe XD', 'Photoshop', 'Illustrator'],
}

COMPANY_TIERS = [
    {'name': 'Startup', 'comp_range': (2000, 6000), 'weight': 0.4},
    {'name': 'Mid-size', 'comp_range': (5000, 12000), 'weight': 0.35},
    {'name': 'Enterprise', 'comp_range': (8000, 20000), 'weight': 0.25},
]


def generate_student():
    n_skills = np.random.randint(2, 8)
    pool_key = np.random.choice(list(SKILL_POOLS.keys()))
    skills = list(np.random.choice(SKILL_POOLS[pool_key], size=min(n_skills, len(SKILL_POOLS[pool_key])), replace=False))

    extra_pool = []
    for k, v in SKILL_POOLS.items():
        if k != pool_key:
            extra_pool.extend(v)
    if extra_pool and np.random.random() > 0.5:
        extras = np.random.choice(extra_pool, size=np.random.randint(1, 3), replace=False)
        skills.extend(list(extras))

    return {
        'skills': list(set(skills)),
        'trust_score': int(np.clip(np.random.normal(45, 25), 0, 100)),
    }


def generate_gig():
    pool_key = np.random.choice(list(SKILL_POOLS.keys()))
    n_required = np.random.randint(2, 6)
    skills_required = list(np.random.choice(
        SKILL_POOLS[pool_key],
        size=min(n_required, len(SKILL_POOLS[pool_key])),
        replace=False
    ))

    tier = np.random.choice(len(COMPANY_TIERS), p=[t['weight'] for t in COMPANY_TIERS])
    comp_low, comp_high = COMPANY_TIERS[tier]['comp_range']
    compensation = int(np.random.uniform(comp_low, comp_high))

    return {
        'id': f'gig_{np.random.randint(10000, 99999)}',
        'skills_required': skills_required,
        'compensation': compensation,
        'duration_days': int(np.random.choice([7, 10, 14, 21, 30])),
        'is_remote': bool(np.random.random() > 0.3),
        'category': pool_key,
    }


def generate_synthetic_interactions(n=3000):
    """Generate synthetic student-gig interaction data with realistic hiring patterns"""
    interactions = []

    for _ in range(n):
        student = generate_student()
        gig = generate_gig()

        student_set = set(student['skills'])
        gig_set = set(gig['skills_required'])
        overlap = len(student_set & gig_set)
        total = max(len(gig_set), 1)
        overlap_ratio = overlap / total

        trust = student['trust_score'] / 100.0

        prob_hire = (
            0.35 * overlap_ratio
            + 0.20 * trust
            + 0.15 * (1.0 if gig['is_remote'] else 0.5)
            + 0.15 * min(gig['compensation'] / 10000, 1.0)
            + 0.15 * np.random.normal(0.5, 0.2)
        )
        prob_hire = np.clip(prob_hire, 0, 1)
        applied = 1 if np.random.random() < 0.6 else 0
        hired = 1 if applied and np.random.random() < prob_hire else 0

        interactions.append({
            'student_id': f'student_{np.random.randint(1000, 9999)}',
            'gig_id': gig['id'],
            'student_skills': student['skills'],
            'gig_skills': gig['skills_required'],
            'trust_score': student['trust_score'],
            'compensation': gig['compensation'],
            'duration_days': gig['duration_days'],
            'is_remote': gig['is_remote'],
            'applied': applied,
            'hired': hired,
        })

    return interactions


def train_with_real_data():
    """Attempt to pull real data from the backend database"""
    try:
        import psycopg2
        conn = psycopg2.connect(
            host='localhost', port=5432,
            dbname='nextgen_campus', user='postgres', password='nextgen123'
        )
        cur = conn.cursor()

        cur.execute("""
            SELECT
                p.skills AS student_skills,
                ga.gig_id,
                g.skills_required AS gig_skills,
                g.compensation,
                g.duration_days,
                g.is_remote,
                p.trust_score,
                ga.status
            FROM gig_applications ga
            JOIN profiles p ON ga.student_id = p.user_id
            JOIN gigs g ON ga.gig_id = g.id
        """)
        rows = cur.fetchall()

        interactions = []
        for row in rows:
            student_skills = row[0] if isinstance(row[0], list) else (row[0] or '').split(',')
            gig_skills = row[2] if isinstance(row[2], list) else (row[2] or '').split(',')
            status = row[7]
            hired = 1 if status in ('accepted', 'completed') else 0
            applied = 1

            interactions.append({
                'student_id': f'db_user',
                'gig_id': str(row[1]),
                'student_skills': [s.strip() for s in student_skills if s.strip()],
                'gig_skills': [s.strip() for s in gig_skills if s.strip()],
                'compensation': float(row[3] or 0),
                'duration_days': int(row[4] or 7),
                'is_remote': bool(row[5]),
                'trust_score': float(row[6] or 50),
                'applied': applied,
                'hired': hired,
            })

        cur.close()
        conn.close()
        return interactions if len(interactions) >= 50 else None

    except Exception as e:
        print(f"Could not connect to database: {e}")
        return None


if __name__ == '__main__':
    use_real = '--real' in sys.argv

    if use_real:
        print("Attempting to train with real database data...")
        interactions = train_with_real_data()
        if interactions is None:
            print("Insufficient real data. Falling back to synthetic data.")
            interactions = generate_synthetic_interactions(3000)
        else:
            print(f"Loaded {len(interactions)} real interactions")
    else:
        print("Generating 3000 synthetic interactions...")
        interactions = generate_synthetic_interactions(3000)

    model = GigRecommender()
    success = model.train_from_interactions(interactions)

    if success:
        print(f"Model trained successfully on {len(interactions)} samples")
        print(f"Model saved to: {model.model_path}")

        # Quick validation
        test_student = {
            'skills': ['React', 'JavaScript', 'Node.js'],
            'trust_score': 65
        }
        results = model.recommend(test_student['skills'], test_student['trust_score'])
        print(f"\nTop 3 recommendations for React developer:")
        for i, r in enumerate(results[:3], 1):
            print(f"  {i}. {r['gig']['title']} — Score: {r['score']}% ({r['recommendation']})")
            print(f"     Match: {r['match_percentage']}% | Gaps: {r['skill_gaps']}")
    else:
        print("Training failed — not enough data")
