;; Open Source Software Development DAO
;; Controls governance, proposal submission, voting, and fund distribution

;; Constants
(define-constant ERR-NOT-AUTHORIZED (err u1))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u2))
(define-constant ERR-INVALID-AMOUNT (err u3))
(define-constant ERR-ALREADY-VOTED (err u4))
(define-constant ERR-PROPOSAL-EXPIRED (err u5))
(define-constant ERR-INSUFFICIENT-BALANCE (err u6))
(define-constant PROPOSAL-DURATION u144) ;; ~1 day in blocks
(define-constant MIN-PROPOSAL-AMOUNT u1000000) ;; in microSTX

;; Data Maps and Variables
(define-map proposals
    { proposal-id: uint }
    {
        creator: principal,
        title: (string-ascii 50),
        description: (string-ascii 500),
        amount: uint,
        status: (string-ascii 20),
        yes-votes: uint,
        no-votes: uint,
        start-block: uint,
        milestones: (list 5 (string-ascii 100)),
        milestone-amounts: (list 5 uint)
    }
)

(define-map votes
    { proposal-id: uint, voter: principal }
    { vote: bool }
)

(define-map token-balances
    { holder: principal }
    { balance: uint }
)

(define-data-var proposal-count uint u0)
(define-data-var dao-treasury uint u0)

;; Governance Token Functions
(define-public (mint-governance-tokens (amount uint) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) ERR-NOT-AUTHORIZED)
        (map-set token-balances
            { holder: recipient }
            { balance: (+ (get-token-balance recipient) amount) })
        (ok true)))

(define-read-only (get-token-balance (holder principal))
    (default-to u0 (get balance (map-get? token-balances { holder: holder }))))

;; Proposal Management
(define-public (submit-proposal (title (string-ascii 50))
                              (description (string-ascii 500))
                              (amount uint)
                              (milestones (list 5 (string-ascii 100)))
                              (milestone-amounts (list 5 uint)))
    (let ((proposal-id (+ (var-get proposal-count) u1)))
        (asserts! (>= (get-token-balance tx-sender) MIN-PROPOSAL-AMOUNT) ERR-INSUFFICIENT-BALANCE)
        (asserts! (>= amount u0) ERR-INVALID-AMOUNT)
        (map-set proposals
            { proposal-id: proposal-id }
            {
                creator: tx-sender,
                title: title,
                description: description,
                amount: amount,
                status: "active",
                yes-votes: u0,
                no-votes: u0,
                start-block: block-height,
                milestones: milestones,
                milestone-amounts: milestone-amounts
            })
        (var-set proposal-count proposal-id)
        (ok proposal-id)))
