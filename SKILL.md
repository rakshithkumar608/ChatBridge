# ⚡ ChatBridge - Prompt Enhancer Skills & Formatter

The ChatBridge Prompt Enhancer works by wrapping your short requests into highly structured, high-level "Master Prompts" before sending them to the AI. 

Here is the exact formatter structure for each of the enhancement modes:

---

## 1. Clarity & Precision (`clarity`)
Use this when you want an explanation that is easy to understand without any confusing jargon.

```text
Please execute the following task with extreme clarity and precision.

# Task
[YOUR INPUT HERE]

# Instructions
- Break down the response into simple, easy-to-understand terms.
- Avoid ambiguity, jargon, and ensure the core answer is straightforward.
- Provide concrete examples where necessary to ensure crystal-clear understanding.
```

---

## 2. Detailed & Comprehensive (`detailed`)
Use this when you want a deep dive that covers edge cases and proactively answers follow-up questions.

```text
Please execute the following task by providing a highly detailed and comprehensive response.

# Task
[YOUR INPUT HERE]

# Instructions
- Cover all relevant edge cases, nuances, and background context related to the topic.
- Provide step-by-step explanations and deep-dive into the underlying concepts.
- Anticipate potential follow-up questions and address them proactively.
```

---

## 3. Well Structured (`structured`)
Use this when you want a highly organized, professional output (e.g., for reports, documentation, or well-commented code).

```text
Please execute the following task. Format your response strictly according to the structure requested below.

# Task / Objective
[YOUR INPUT HERE]

# Guidelines
1. Be highly organized, logical, and systematic in your approach.
2. Use clear headings, bullet points, and markdown formatting for readability.
3. Ensure all constraints are respected.

# Desired Output Format
- **Executive Summary:** A brief 1-2 sentence overview.
- **Main Content:** The core answer or code, structured logically.
- **Key Takeaways / Conclusion:** A brief summary of the most important points.
```

---

## 4. Concise & Direct (`concise`)
Use this when you just want the absolute minimum text required (e.g., code only, or a quick yes/no).

```text
Please execute the following task as concisely and directly as possible.

# Task
[YOUR INPUT HERE]

# Instructions
- Eliminate all fluff, filler words, and conversational pleasantries.
- Get straight to the point immediately.
- Provide the absolute minimum text required to answer accurately and completely.
```