'use client'

import { useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { AgentCard } from '@/components/AgentCard'
import { SynthesisScoreCard, SynthesisIssuesPanel } from '@/components/SynthesisPanel'
import type { Synthesis, AgentResult } from '@/lib/api'

// ── Example code ─────────────────────────────────────────────────────────────

const EXAMPLE_CODE = `import java.sql.*;
import java.util.*;

public class UserService {
    static Connection conn;
    static String SECRET_KEY = "myS3cr3tKey_2024!";

    public static void connect() throws Exception {
        conn = DriverManager.getConnection(
            "jdbc:mysql://localhost/mydb", "root", "password123"
        );
    }

    public static String getUser(String userId) throws Exception {
        String query = "SELECT * FROM users WHERE id = '" + userId + "'";
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(query);

        if (rs.next()) {
            return rs.getString("username") + ":" + rs.getString("password_hash");
        }
        return null;
    }

    public static List<String> getAllUsers() throws Exception {
        List<String> users = new ArrayList<>();
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery("SELECT * FROM users");

        while (rs.next()) {
            users.add(rs.getString("username") + ":" + rs.getString("email")
                + ":" + rs.getString("password_hash"));
        }
        return users;
    }

    public static boolean login(String user, String pass) throws Exception {
        String q = "SELECT * FROM users WHERE username='" + user
            + "' AND password='" + pass + "'";
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(q);
        return rs.next();
    }

    public static void deleteUser(String userId) throws Exception {
        String q = "DELETE FROM users WHERE id=" + userId;
        conn.createStatement().execute(q);
        System.out.println("Deleted user: " + userId);
    }
}`

// ── Hardcoded agent results ───────────────────────────────────────────────────

const AGENT_RESULTS: Record<string, AgentResult> = {
  pragmatist: {
    summary: 'This code has severe production-readiness problems. A static shared connection will break under any concurrent load, resources are never closed, and exceptions are propagated raw with no meaningful handling layer.',
    issues: [
      {
        title: 'Static shared Connection is not thread-safe',
        description: 'A single static Connection object shared across all callers will cause race conditions under concurrent requests. Use a connection pool (HikariCP) instead.',
        severity: 'critical',
        line_hint: 'static Connection conn;',
      },
      {
        title: 'Statements and ResultSets are never closed',
        description: 'Every query leaks a Statement and ResultSet. Under any real load this will exhaust database cursors and crash the process.',
        severity: 'critical',
        line_hint: 'Statement stmt = conn.createStatement();',
      },
      {
        title: 'Hardcoded database credentials',
        description: 'Username "root" and password "password123" are hardcoded in source. These must come from environment variables or a secrets manager.',
        severity: 'critical',
        line_hint: '"jdbc:mysql://localhost/mydb", "root", "password123"',
      },
      {
        title: 'getAllUsers() loads entire table into memory',
        description: 'Fetching every user row into a List with no pagination will OOM the JVM on any database with more than a few thousand rows.',
        severity: 'warning',
        line_hint: 'SELECT * FROM users',
      },
      {
        title: 'System.out used instead of a logger',
        description: 'System.out.println cannot be configured, filtered, or shipped to a log aggregator. Use SLF4J or java.util.logging.',
        severity: 'suggestion',
        line_hint: 'System.out.println("Deleted user: " + userId);',
      },
    ],
  },
  paranoid: {
    summary: 'This file is a textbook of SQL injection vulnerabilities. Every single query builds SQL by string concatenation. A single malicious input string can dump the entire database, bypass authentication, or delete all rows.',
    issues: [
      {
        title: 'SQL injection in getUser()',
        description: "String concatenation directly into a SQL query. Input like `' OR '1'='1` returns all users. Use PreparedStatement with parameterized queries.",
        severity: 'critical',
        line_hint: '"SELECT * FROM users WHERE id = \'" + userId + "\'"',
      },
      {
        title: 'Authentication bypass via SQL injection in login()',
        description: "Passing `' OR '1'='1` as the username logs in as any user. This is the oldest SQL injection attack in existence and fully exploitable here.",
        severity: 'critical',
        line_hint: '"SELECT * FROM users WHERE username=\'" + user + "\' AND password=\'" + pass + "\'"',
      },
      {
        title: 'SQL injection in deleteUser()',
        description: 'Unsanitized userId concatenated into DELETE. An attacker passing `1 OR 1=1` deletes every row in the users table.',
        severity: 'critical',
        line_hint: '"DELETE FROM users WHERE id=" + userId',
      },
      {
        title: 'Hardcoded SECRET_KEY in source',
        description: 'The SECRET_KEY is committed to source control and visible to anyone with repo access. Rotate it immediately and move it to an environment variable.',
        severity: 'critical',
        line_hint: 'static String SECRET_KEY = "myS3cr3tKey_2024!";',
      },
      {
        title: 'password_hash returned to callers',
        description: 'getUser() and getAllUsers() return the password_hash field to callers. Password hashes should never leave the data layer.',
        severity: 'warning',
        line_hint: 'rs.getString("password_hash")',
      },
    ],
  },
  minimalist: {
    summary: 'The class mixes connection management, querying, and business logic with no separation of concerns. Static state makes it untestable. Method signatures expose raw database types through the entire call stack.',
    issues: [
      {
        title: 'Static mutable state makes the class untestable',
        description: 'Static Connection and SECRET_KEY fields cannot be injected or mocked. This class cannot be unit tested without a live database.',
        severity: 'critical',
        line_hint: 'static Connection conn;',
      },
      {
        title: 'No separation of concerns',
        description: 'Connection management, SQL execution, and data mapping all live in one class. Apply the Repository pattern: split connection setup from query logic.',
        severity: 'warning',
        line_hint: 'UserService.java',
      },
      {
        title: 'getUser() returns a colon-delimited string instead of an object',
        description: 'Returning "username:password_hash" forces callers to parse a string. Return a proper User value object.',
        severity: 'warning',
        line_hint: 'return rs.getString("username") + ":" + rs.getString("password_hash");',
      },
      {
        title: 'SELECT * used throughout',
        description: 'SELECT * fetches every column including ones added in the future. Always name columns explicitly to make queries stable and readable.',
        severity: 'suggestion',
        line_hint: 'SELECT * FROM users',
      },
    ],
  },
  optimizer: {
    summary: 'The connection is never pooled, every call creates a new Statement, and getAllUsers() pulls the full table into heap memory. None of these patterns survive any real throughput.',
    issues: [
      {
        title: 'No connection pooling',
        description: 'Creating a single raw Connection and sharing it statically is the worst of both worlds: not pooled, not thread-safe. Use HikariCP with a configured pool size.',
        severity: 'critical',
        line_hint: 'conn = DriverManager.getConnection(...)',
      },
      {
        title: 'getAllUsers() has O(n) memory growth',
        description: 'Loading all users into a List scales linearly with table size. Stream results with cursor-based pagination or return an iterator rather than materialising the full result.',
        severity: 'warning',
        line_hint: 'List<String> users = new ArrayList<>();',
      },
      {
        title: 'Statements are not reused',
        description: 'A new Statement is created for every call. PreparedStatements can be cached and reused, reducing parse overhead on the database.',
        severity: 'suggestion',
        line_hint: 'conn.createStatement()',
      },
    ],
  },
  mentor: {
    summary: 'Someone new to this codebase will have no idea what SECRET_KEY is used for, why connect() must be called before anything else, or what the colon-delimited strings returned by getUser() are supposed to represent.',
    issues: [
      {
        title: 'No documentation on initialization order',
        description: 'connect() must be called before any other method or a NullPointerException is thrown. This implicit contract is invisible and will bite every new developer.',
        severity: 'critical',
        line_hint: 'public static void connect() throws Exception',
      },
      {
        title: 'SECRET_KEY has no explanation',
        description: 'The field is defined but never used in this file. A new developer cannot tell what it signs, whether it is still needed, or whether it is safe to change.',
        severity: 'warning',
        line_hint: 'static String SECRET_KEY = "myS3cr3tKey_2024!";',
      },
      {
        title: 'Return format of getUser() is undocumented',
        description: 'Returning "username:password_hash" with no Javadoc means callers must read the implementation to know what they are splitting on.',
        severity: 'warning',
        line_hint: 'return rs.getString("username") + ":" + rs.getString("password_hash");',
      },
      {
        title: 'Exception handling strategy is undefined',
        description: 'Every method declares throws Exception. There is no guidance on which exceptions are recoverable, which are fatal, or how callers should respond.',
        severity: 'suggestion',
        line_hint: 'throws Exception',
      },
    ],
  },
}

// ── Hardcoded synthesis ───────────────────────────────────────────────────────

const SYNTHESIS: Synthesis = {
  overall_score: 91,
  summary: 'This code should not be anywhere near production. It has multiple directly exploitable SQL injection vulnerabilities, a hardcoded secret key, no connection pooling, and zero resource cleanup. The entire class needs to be rewritten using PreparedStatements, a connection pool, and proper separation of concerns before it can be considered safe.',
  critical: [
    {
      title: 'SQL injection in every query',
      description: 'All four SQL queries build strings via concatenation. An attacker can dump, modify, or delete the entire database without any credentials.',
      agents: ['pragmatist', 'paranoid', 'minimalist'],
    },
    {
      title: 'Authentication bypass in login()',
      description: "Passing `' OR '1'='1` as the username bypasses password checking entirely. Any user can log in as any other user.",
      agents: ['paranoid'],
    },
    {
      title: 'Hardcoded credentials and secret key',
      description: 'Database credentials and a secret key are committed to source. These are exposed to every person with repository access.',
      agents: ['pragmatist', 'paranoid', 'mentor'],
    },
    {
      title: 'Static Connection is not thread-safe',
      description: 'Concurrent requests will corrupt each other\'s queries and produce unpredictable results or exceptions.',
      agents: ['pragmatist', 'optimizer'],
    },
  ],
  warnings: [
    {
      title: 'All resources leak on every call',
      description: 'Statements and ResultSets are opened but never closed. The database will run out of cursors under any sustained load.',
      agents: ['pragmatist'],
    },
    {
      title: 'getAllUsers() loads entire table into memory',
      description: 'No pagination means memory grows linearly with the number of users.',
      agents: ['pragmatist', 'optimizer'],
    },
    {
      title: 'password_hash exposed to callers',
      description: 'Password hashes are returned as part of string responses and should never leave the data layer.',
      agents: ['paranoid'],
    },
    {
      title: 'No separation of concerns',
      description: 'Connection management, SQL, and business logic are mixed into one untestable static class.',
      agents: ['minimalist', 'mentor'],
    },
  ],
  suggestions: [
    {
      title: 'Replace System.out with a proper logger',
      description: 'Use SLF4J so log output can be configured and aggregated.',
      agents: ['pragmatist'],
    },
    {
      title: 'Name columns explicitly instead of SELECT *',
      description: 'Makes queries stable against schema changes and easier to audit.',
      agents: ['minimalist'],
    },
    {
      title: 'Cache and reuse PreparedStatements',
      description: 'Reduces database parse overhead on hot query paths.',
      agents: ['optimizer'],
    },
    {
      title: 'Document the initialization contract',
      description: 'connect() must be called first — make this explicit in Javadoc or enforce it via a constructor.',
      agents: ['mentor'],
    },
  ],
  conflicts: [
    {
      topic: 'Is a full rewrite necessary or can this be patched?',
      positions: {
        pragmatist: 'The structural problems (static state, no pooling, mixed concerns) require a rewrite, not a patch.',
        minimalist: 'Agreed — the architecture is the problem, not just the SQL strings.',
        mentor: 'Patching the SQL injection alone leaves the hidden initialization contract and opaque return types, which will keep causing bugs.',
      },
    },
  ],
}

// ── Page ─────────────────────────────────────────────────────────────────────

const AGENT_NAMES = ['pragmatist', 'paranoid', 'minimalist', 'optimizer', 'mentor'] as const

export default function ExamplePage() {
  const [codeVisible, setCodeVisible] = useState(false)

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-dvh bg-canvas">
        <div className="container-xl py-12 space-y-10">

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <span className="eyebrow block mb-3">Example review</span>
              <h1 className="text-2xl font-bold tracking-tight text-ink">UserService.java</h1>
              <p className="text-sm text-muted mt-1">Java &middot; 55 lines &middot; intentionally broken</p>
            </div>
          </div>

          {/* Code block */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setCodeVisible(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-ink hover:bg-subtle/50 transition-colors border-b border-black/[0.06]"
            >
              <span className="font-mono text-xs text-muted">UserService.java</span>
              <span className="text-xs text-muted">{codeVisible ? 'Hide code' : 'Show code'}</span>
            </button>
            {codeVisible && (
              <pre className="p-5 overflow-x-auto text-xs font-mono text-ink leading-relaxed bg-subtle/30">
                <code>{EXAMPLE_CODE}</code>
              </pre>
            )}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-3">
              <p className="eyebrow mb-3">Agent Reviews</p>
              {AGENT_NAMES.map((name) => (
                <AgentCard key={name} name={name} result={AGENT_RESULTS[name]} />
              ))}
            </div>
            <div className="lg:sticky lg:top-24">
              <p className="eyebrow mb-3">Final Verdict</p>
              <SynthesisScoreCard synthesis={SYNTHESIS} />
            </div>
          </div>

          {/* Issues panel */}
          <div>
            <p className="eyebrow mb-4">Findings</p>
            <SynthesisIssuesPanel synthesis={SYNTHESIS} />
          </div>

          {/* CTA */}
          <div className="card p-8 text-center">
            <p className="text-lg font-semibold text-ink mb-2">Ready to roast your own code?</p>
            <p className="text-sm text-muted mb-6">Free to use. No account required. Results in under 60 seconds.</p>
            <a href="/" className="btn-primary text-sm px-8 py-3 inline-flex">
              Submit your code
            </a>
          </div>

        </div>
      </main>
    </>
  )
}
