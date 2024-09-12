import { createContext, useState, useContext } from 'react';
import React, { useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const savedTheme = localStorage.getItem('theme') || 'light'; // Default to 'light' if no theme is saved
    const [theme, setTheme] = useState(savedTheme);

    // Function to set a specific theme
    const changeTheme = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme); // Save the selected theme to localStorage
    };

    useEffect(() => {
        document.body.className = theme; // Apply the theme class to the body element
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, changeTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
