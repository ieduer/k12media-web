/**
 * AI Features Module (Placeholder)
 * 
 * This module contains stub functions for future AI integration:
 * - Text recognition via Gemini API
 * - AI-powered answer grading
 */

class AIFeatures {
    constructor() {
        this.geminiApiKey = null;
    }

    /**
     * Set Gemini API key
     */
    setApiKey(apiKey) {
        this.geminiApiKey = apiKey;
        localStorage.setItem('gemini_api_key', apiKey);
    }

    /**
     * Get stored API key
     */
    getApiKey() {
        if (!this.geminiApiKey) {
            this.geminiApiKey = localStorage.getItem('gemini_api_key');
        }
        return this.geminiApiKey;
    }

    /**
     * Recognize text from answer sheet image
     * @param {string} imageUrl - URL of the image
     * @param {number} subjectId - Subject ID for context
     * @returns {Promise<object>} - Recognized text and structure
     */
    async recognizeText(imageUrl, subjectId) {
        // TODO: Implement Gemini Vision API integration
        // 
        // Example implementation:
        // const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro-vision:generateContent', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'x-goog-api-key': this.geminiApiKey,
        //   },
        //   body: JSON.stringify({
        //     contents: [{
        //       parts: [
        //         { text: '請識別這份試卷中的所有文字，包括題目和學生的答案。' },
        //         { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
        //       ]
        //     }]
        //   })
        // });

        throw new Error('AI 文字識別功能尚未實現。請等待後續更新。');
    }

    /**
     * Grade a single answer using AI
     * @param {string} imageUrl - URL of the answer sheet image
     * @param {number} subjectId - Subject ID
     * @param {object} answers - Standard answers { questionNo: correctAnswer }
     * @returns {Promise<object>} - Grading results
     */
    async gradeAnswer(imageUrl, subjectId, answers) {
        // TODO: Implement AI grading
        //
        // Steps:
        // 1. Recognize text from image
        // 2. Parse student answers
        // 3. Compare with standard answers
        // 4. Generate score and feedback
        //
        // Example prompt for Gemini:
        // "請根據以下標準答案評閱學生的答卷：
        //  標準答案：${JSON.stringify(answers)}
        //  請給出每題的得分和總分，並指出錯誤之處。"

        throw new Error('AI 閱卷功能尚未實現。請等待後續更新。');
    }

    /**
     * Grade all subjects for a student
     * @param {string} studentId - Student identifier
     * @param {object} answersMap - { subjectId: { questionNo: answer } }
     * @returns {Promise<object>} - All grading results
     */
    async gradeAllSubjects(studentId, answersMap) {
        // TODO: Implement batch grading
        //
        // For each subject:
        // 1. Fetch all answer sheet images
        // 2. Recognize and grade each page
        // 3. Aggregate results

        throw new Error('全科目批閱功能尚未實現。請等待後續更新。');
    }

    /**
     * Check if AI features are available
     */
    isAvailable() {
        return false; // Set to true when implemented
    }
}

// Export singleton
window.aiFeatures = new AIFeatures();
