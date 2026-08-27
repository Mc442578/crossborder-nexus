# ADR 0001: Build an independent integration repository

Date: 2026-08-27

## Decision

Create a new MIT-licensed CrossBorder Nexus repository instead of renaming or mechanically merging an existing application.

## Reasons

- The closest domain reference uses Microsoft Agent Framework, while the resume and target architecture use LangGraph.
- JoyAgent and the AWS sample introduce large runtime and cloud dependencies that are unnecessary for a portfolio demonstration.
- Xiaobei and ClipForge have license conditions that make direct code combination undesirable for this repository.
- Independent modules make attribution, technical ownership, and interview explanations clearer.

## Consequences

The repository may study and cite upstream designs, but copied or substantially adapted files require explicit attribution. Completeness is judged through code and documentation coverage rather than production deployment.
