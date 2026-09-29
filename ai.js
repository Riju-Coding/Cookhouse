const jarvis = require('jarvis-ai');

const ai = new jarvis.AI({
  apiKey: process.env.JARVIS_API_KEY,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 150,
});

module.exports = ai;

ai.generate('Hello, how can I assist you today?')
  .then(response => {
    console.log('AI Response:', response);  
    });

ai.generate('What is the weather like today?')
  .then(response => {
    console.log('AI Response:', response);  
    });


return ai;