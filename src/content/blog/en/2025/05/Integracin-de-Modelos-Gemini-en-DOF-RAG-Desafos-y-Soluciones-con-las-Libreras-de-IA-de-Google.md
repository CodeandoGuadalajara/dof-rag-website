---
title: >-
  Integrating Gemini Models in DOF RAG: Challenges and Solutions with Google's AI Libraries
date: 2025-05-16T06:00:00.000Z
author: DOF-RAG Team
description: >-
  An analysis of the challenges encountered during the integration of Google's AI models in the DOF RAG project, managing evolving libraries, and solving API-related issues.
image: '/images/posts/2025/05/ChatGPT Image 16 may 2025, 05_48_58 p.m..png'
tags:
  - Experiencia de Desarrollo
  - Dificultades
  - Google
  - Gemini
  - DOF-RAG
---

In the **DOF-RAG Project** team, our fundamental mission is to improve the accessibility and understanding of information contained in the Official Journal of the Federation. As part of this technological initiative, we made the decision to integrate Google's Artificial Intelligence models. This choice was based on the availability of a robust free tier, suitable for our initial tests with an LLM, and its usefulness for critical tasks such as extracting descriptions from images—an essential component of our RAG architecture—and performing queries to validate the quality of our embeddings. The strategic objective is to automate the ingestion and processing of images and, crucially, enable our RAG system to answer queries based on the extensive document corpus of the DOF.

However, the integration process presented a significant detour through Google's AI library ecosystem.

## First Steps: Navigating the Library Ecosystem

Our initial foray was with the `generativeai` library. This was the implementation available at that time and met the basic requirements. However, the rapid evolution of the AI field soon directed us toward `genai`, a more recent library that promised improved integration and access to Google's most advanced models, such as Gemini 2.0 and Gemma 3. The conceptual transition between these libraries was relatively straightforward; the initial implementation seemed simple and the way forward, clear.

## `genai`: Potential and Challenges of an Emerging Technology

The prospect of using the latest models was appealing. However, working with technology in early development stages comes with particularities. During late April and early May, we faced a complex and changing scenario. Usage policies seemed to fluctuate, the library implementation itself was evolving rapidly, and these changes were occurring in a short period.

The main difficulty arose with API key management. We had a key that had worked correctly in previous tests. However, the system unexpectedly began to reject it. This problem persisted even when using the example scripts provided by Google in their official documentation. Various causes were considered, from cache problems to incorrect interpretations of environment variables by the terminal. Measures such as restarting the development environment were taken, although without a clear expectation of immediate resolution.

Frequent version changes in the libraries (for example, the `google` library went from version 0.3.0 to over 3.0 in a few weeks, with `genai` following a similar pattern) presented additional challenges. Although, in retrospect, the most substantial changes focused on incorporating model "thinking" configuration, they implied revisions and adaptations to our code at the time. For example, the method for sending images and obtaining their descriptions had to be modified. Nevertheless, persistent and difficult-to-diagnose errors related to the API key continued to be the most significant obstacle, despite following Google's recommended implementations.

## Diagnosing API Key Problems

Error messages consistently indicated an "invalid API key." This was puzzling as the same key had been successfully used in previous tests for extracting image descriptions with the `gemini-2.0-flash` model (selected for its free tier). Even Google's official code, replicated exactly in our local environment, produced the same error.

The Google Cloud administration console reported no anomalies; the API key appeared as active and with no apparent restrictions. A thorough review of the local environment was conducted: new terminal instances were created, cache clearing was attempted, and the code editor was restarted multiple times. The problem, however, persisted for several days.

## The Unexpected Resolution of the Problem

Finally, after several attempts and without an identifiable specific modification to justify it, the integration began to work correctly.

In a new effort, the code provided by Google AI Studio was reimplemented in a completely isolated environment. On this occasion, the execution was successful. The exact cause of the resolution could not be determined with precision. The code was essentially identical to that previously used in the main test environment.

Unexpectedly, the API key was accepted, API calls were completed, and the models responded as expected. The resolution was surprising and did not come from a direct and deliberate correction on our part. It is speculated that the solution may have been due to undocumented updates in Google's infrastructure or unidentified factors in the local environment that were fortuitously corrected. This outcome generated relief, although also some perplexity given the elusive nature of the problem and its eventual self-resolution.

## Evaluation of "Thinking Models" for DOF RAG

The most recent versions of the libraries introduced the ability to configure model "thinking time." While it's an interesting feature, for the current objectives of the DOF RAG project, its utility is limited.

In the context of automating the extraction of image descriptions, adding additional latency for "thinking" for each of the thousands of processed images is not practical. For our RAG chatbot, response agility is a critical factor; users expect quick answers to their queries.

However, this functionality could potentially benefit the validation of the relevance of the context provided to the LLM. For example, to verify if a DOF article has been repealed or replaced by a more recent one, or if a cited law remains in force. However, for the bot's direct response generation process, efficiency is prioritized.

## Lessons Learned in AI Integration and Recommendations

This experience in integrating Google's AI libraries provided us with several important lessons:

1. **Caution with early adoption of technologies:** Libraries in initial development phases, although innovative, may present a higher frequency of changes, incomplete documentation, and unexpected errors. Identifying the root cause of problems may require a considerable investment of time and effort.
2. **Consider stability before updating:** Unless a new version offers indispensable critical functionality or solves a blocking problem, it may be prudent to wait for libraries to reach a greater degree of maturity before proceeding with the update. Otherwise, frequent code modification cycles are likely to be required.

## Conclusion and Next Steps

Despite the obstacles encountered, we have managed to overcome these technical challenges. The implementation for image processing has reached a stable state, and we hope it maintains its reliability in the future. The DOF RAG project continues its development as planned, and the team is optimistic about upcoming advances.

We appreciate your continued interest in our project and invite you to follow our blog to stay informed about progress, technical challenges, and development process experiences. 