"""
Supply Chain Resilience Agent — Flask Intelligence Hub.
Entry point: registers all route blueprints, initializes simulators, seeds demo data.
"""

from flask import Flask
from flask_cors import CORS

from routes.disruption import disruption_bp

from routes.feedback import feedback_bp
from routes.graph import graph_bp
from routes.suppliers import suppliers_bp
from routes.actions import actions_bp
from routes.settings import settings_bp
from routes.simulate import simulate_bp
from routes.safety import safety_bp
from routes.cron import cron_bp
from data.seed import seed_all


def create_app():
    app = Flask(__name__)
    CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

    # Register blueprints
    app.register_blueprint(disruption_bp)

    app.register_blueprint(feedback_bp)
    app.register_blueprint(graph_bp)
    app.register_blueprint(suppliers_bp)
    app.register_blueprint(actions_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(simulate_bp, url_prefix="/api")
    app.register_blueprint(safety_bp, url_prefix="/api")
    app.register_blueprint(cron_bp, url_prefix="/api/cron")

    # Health check
    @app.route("/api/health", methods=["GET"])
    def health():
        return {"status": "ok", "service": "Supply Chain Resilience Agent"}

    return app


if __name__ == "__main__":
    # Seed demo data on startup
    print("🌱 Seeding demo supply chain data...")
    seed_all()
    print("✅ Seed complete: 8 suppliers, 7 sub-suppliers, 6 regions, 12 components, 4 products, 3 lessons")
    print("🚀 Starting Intelligence Hub on http://localhost:5000")

    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
