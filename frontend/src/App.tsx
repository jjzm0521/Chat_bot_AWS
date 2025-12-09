import { useState } from 'react'
import ChatWidget from './components/ChatWidget'
import './styles/App.css'

function App() {
    const [isChatOpen, setIsChatOpen] = useState(false)

    return (
        <div className="app">
            {/* Landing Page */}
            <header className="hero">
                <div className="hero-content">
                    <div className="hero-badge">🤖 AI Powered</div>
                    <h1 className="hero-title">
                        Chatbot <span className="gradient-text">Inteligente</span>
                    </h1>
                    <p className="hero-subtitle">
                        Asistente virtual con NLP y Machine Learning.
                        Soporte multi-idioma en Español, Inglés y Portugués.
                    </p>
                    <div className="hero-features">
                        <div className="feature">
                            <span className="feature-icon">🧠</span>
                            <span>Comprensión Natural</span>
                        </div>
                        <div className="feature">
                            <span className="feature-icon">💬</span>
                            <span>Análisis de Sentimiento</span>
                        </div>
                        <div className="feature">
                            <span className="feature-icon">🌍</span>
                            <span>Multi-idioma</span>
                        </div>
                    </div>
                    <button
                        className="cta-button"
                        onClick={() => setIsChatOpen(true)}
                    >
                        Iniciar Conversación
                        <span className="button-arrow">→</span>
                    </button>
                </div>
                <div className="hero-visual">
                    <div className="floating-card card-1">
                        <span className="card-emoji">👋</span>
                        <span>¡Hola! ¿En qué puedo ayudarte?</span>
                    </div>
                    <div className="floating-card card-2">
                        <span className="card-emoji">📊</span>
                        <span>Sentiment: Positivo</span>
                    </div>
                    <div className="floating-card card-3">
                        <span className="card-emoji">🌐</span>
                        <span>ES • EN • PT</span>
                    </div>
                </div>
            </header>

            {/* Features Section */}
            <section className="features-section">
                <h2 className="section-title">Características Principales</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-card-icon">🔮</div>
                        <h3>Amazon Lex</h3>
                        <p>Motor de conversación NLU con intents y slots personalizados</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-icon">💭</div>
                        <h3>Amazon Comprehend</h3>
                        <p>Análisis de sentimiento en tiempo real para cada interacción</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-icon">🌍</div>
                        <h3>Amazon Translate</h3>
                        <p>Traducción automática para soporte multi-idioma</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-card-icon">⚡</div>
                        <h3>Serverless</h3>
                        <p>Arquitectura escalable con Lambda, API Gateway y DynamoDB</p>
                    </div>
                </div>
            </section>

            {/* Chat Widget */}
            <ChatWidget
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
            />

            {/* Floating Chat Button */}
            {!isChatOpen && (
                <button
                    className="chat-fab"
                    onClick={() => setIsChatOpen(true)}
                    aria-label="Abrir chat"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>
            )}

            {/* Footer */}
            <footer className="footer">
                <p>Powered by AWS • Amazon Lex • Comprehend • Translate</p>
            </footer>
        </div>
    )
}

export default App
