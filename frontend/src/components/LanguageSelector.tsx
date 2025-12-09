import { useState } from 'react';
import { LANGUAGES, Language } from '../types/chat.types';
import '../styles/LanguageSelector.css';

interface LanguageSelectorProps {
    currentLanguage: Language;
    onLanguageChange: (language: Language) => void;
}

function LanguageSelector({ currentLanguage, onLanguageChange }: LanguageSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const currentLang = LANGUAGES.find(l => l.code === currentLanguage);

    const handleSelect = (language: Language) => {
        onLanguageChange(language);
        setIsOpen(false);
    };

    return (
        <div className="language-selector">
            <button
                className="language-selector-trigger"
                onClick={() => setIsOpen(!isOpen)}
                title="Cambiar idioma"
            >
                <span className="lang-flag">{currentLang?.flag}</span>
                <span className="lang-code">{currentLanguage.toUpperCase()}</span>
                <span className="lang-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="language-dropdown">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            className={`language-option ${lang.code === currentLanguage ? 'active' : ''}`}
                            onClick={() => handleSelect(lang.code)}
                        >
                            <span className="lang-flag">{lang.flag}</span>
                            <span className="lang-name">{lang.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default LanguageSelector;
