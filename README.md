# 🌊 FlowSense – Intelligent Team Optimization System

> **AI-powered system to optimize team workload, prevent burnout, and improve project efficiency.**

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://flow-sense.vercel.app)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/atlas)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google-gemini)](https://ai.google.dev/)

---

## 📖 Problem Statement

In today's fast-paced corporate environment, traditional project management tools often fall short because they are purely **reactive** rather than **proactive**.

*   **Task Overload:** Managers lack real-time visibility into employee "mental bandwidth," leading to burnout.
*   **Lack of Visibility:** High-level project health is often obscured by hundreds of micro-tasks.
*   **Static Decision Support:** Assigning tasks is usually a guessing game based on who "looks" free, rather than data-driven capacity analysis.
*   **Communication Gaps:** Project discussions are scattered across emails and multiple chat apps, losing critical context.

---

## 💡 Solution Overview

**FlowSense** is an intelligent ecosystem designed to bridge the gap between project tracking and team well-being. It transforms raw project data into actionable intelligence.

*   **Smart Task Assignment:** Automatically suggests the best team member for a task based on current workload and skill set.
*   **Workload Balancing:** Uses a proprietary algorithm to detect potential overloads before they happen.
*   **Real-time Communication:** Integrated project-specific and direct chat channels to keep everyone aligned.
*   **AI-Based Insights:** A natural language assistant that understands your team's state and answers complex operational queries.

---

## ✨ Key Features

### 🔹 Core Features (MVP)
*   **Company-Based Hierarchy:** Secure multi-tenant architecture where companies manage their own employee ecosystems.
*   **Project & Team Management:** Intuitive interface for creating project streams and assembling expert rosters.
*   **Dynamic Task Assignment:** Granular task management with priority levels and deadline tracking.
*   **Live Workload Tracking:** Real-time percentage-based workload calculation for every team member.

### 🔹 Advanced Features (Prototype)
*   **Smart Workload Analysis:** Visual indicators (🔴 🟡 🟢) to immediately identify team members at risk of burnout.
*   **AI-Powered Query System:** Integration with **Google Gemini** to allow natural language interaction with your project data.
*   **Real-Time Sync:** Firebase-powered instant messaging and notification system.
*   **Insights Dashboard:** Dynamic, interactive graphs providing a high-level view of organization health and project velocity.

---

## 🤖 AI Integration

FlowSense leverages the **Google Gemini API** to provide a "Brain" for your organization. Instead of digging through spreadsheets, leaders can simply ask questions.

*   **Natural Language Queries:** Ask things like *"Who is free for a React task?"* or *"Which projects are currently at risk?"*
*   **Lightweight RAG Approach:** The system retrieves real-time data from MongoDB, injects it into the prompt context (Retrieval-Augmented Generation), and uses Gemini to generate intelligent, context-aware responses.
*   **Operational Intelligence:** AI analyzes team efficiency and suggests optimizations for better resource allocation.

---

## 🧠 System Architecture

FlowSense is built on a modern, scalable stack designed for high-performance and real-time responsiveness.

*   **Frontend:** Vanilla HTML5, CSS3 (Modern Glassmorphism Design), and JavaScript (ES6+).
*   **Backend:** Node.js & Express.js for a robust RESTful API.
*   **Database:** MongoDB Atlas for flexible, document-based data storage.
*   **Real-time & Auth:** Firebase (Auth & Firestore) for secure sessions and instant data synchronization.
*   **AI Engine:** Google Gemini API for advanced natural language processing.

---

## 🏗️ Workflow (How it works)

1.  **Company Registration:** An organization creates a secure account and receives a unique company access code.
2.  **Employee Onboarding:** Team members join the company ecosystem using the secure invite code.
3.  **Project Initiation:** Team leads create projects and define core objectives.
4.  **Resource Synthesis:** Leads assemble teams by selecting members; the system warns if a member is already over-leveraged.
5.  **Task Orchestration:** Tasks are assigned with specific hour estimates, updating the team's workload live.
6.  **Intelligence Layer:** AI and Insights dashboards monitor health, allowing leads to rebalance tasks with a single click.

---

## 📊 Screens / Demo

| Dashboard | Task Management |
| :---: | :---: |
| ![Dashboard](./assets/dashboard.png) | ![Task Assignment](./assets/task_assignment.png) |

| AI Assistant | Real-time Chat |
| :---: | :---: |
| ![AI Query](./assets/ai_query.png) | ![Chat](./assets/chat.png) |

*(Note: Screenshots are representative of the current prototype interface)*

---

## 🔗 Live Links

*   🚀 **[MVP Live Link](https://flow-sense.vercel.app)**
*   🛠️ **[Prototype Demo](https://flow-sense-proto.vercel.app)**
*   📺 **[Product Walkthrough Video](https://youtube.com/link-to-demo)**

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript, Chart.js, FontAwesome |
| **Backend** | Node.js, Express.js, JWT |
| **Database** | MongoDB Atlas, Mongoose |
| **Real-time** | Firebase Firestore, Firebase Auth |
| **AI** | Google Gemini Pro, RAG Architecture |
| **Deployment** | Vercel (Frontend/Backend), MongoDB Cloud |

---

## ⚡ Challenges Solved

*   **Real-time Synchronization:** Implementing Firebase to ensure that chat messages and workload updates reflect instantly across all client sessions.
*   **Data Density Management:** Designing a "Lightweight RAG" system that can efficiently pass MongoDB documents to the Gemini API without exceeding token limits or sacrificing accuracy.
*   **Responsive UI/UX:** Crafting a premium, Glassmorphic interface that maintains high performance on both mobile and desktop browsers.
*   **Complex Workload Calculations:** Developing a mathematical model that accurately translates task hours, priorities, and deadlines into a "percentage capacity" metric.

---

## 🚀 Future Scope

*   **Predictive Burnout Analytics:** Using historical data to predict when an employee is likely to reach a burnout state weeks in advance.
*   **Automated Task Rebalancing:** An "Auto-Pilot" mode that suggests and (with approval) executes task reassignments to optimize team velocity.
*   **Advanced RAG System:** Moving beyond simple context injection to a full vector-database approach for searching through years of project archives.
*   **Slack/Teams Integration:** Bringing FlowSense intelligence directly into existing corporate communication channels.

---

## 👨‍💻 Team / Author

*   **Rudranan Arulmani**
*   **Vedika Warge**

---

*FlowSense was developed with a focus on human-centric project management. Because a healthy team is a productive team.*
