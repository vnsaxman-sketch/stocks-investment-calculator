import { useMemo, useState } from "react";
import "./index.css";
type AccountType = "Taxable Brokerage" | "Traditional IRA / 401(k)" | "Roth IRA / Roth 401(k)" | "SEP / SIMPLE" | "HSA" | "529 / Custodial / Other";
type Filing = "Single" | "Married Filing Jointly" | "Head of Household";
type ContribFreq = "Monthly" | "Biweekly" | "Yearly";
type WithdrawMode = "None" | "One-time" | "Monthly for N years" | "Yearly for N years" | "4% Rule";
function fmt(n:number){ if(!isFinite(n)) return "$0"; return n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}); }
export default function App(){
  const [currentAge,setCurrentAge]=useState(35);
  const [retireAge,setRetireAge]=useState(65);
  const [lifeAge,setLifeAge]=useState(90);
  const [starting,setStarting]=useState(10000);
  const [contrib,setContrib]=useState(500);
  const [contribFreq,setContribFreq]=useState<ContribFreq>("Monthly");
  const [contribGrowth,setContribGrowth]=useState(3);
  const [annualReturn,setAnnualReturn]=useState(8);
  const [returnType,setReturnType]=useState("Nominal");
  const [inflation,setInflation]=useState(3);
  const [dividendYield,setDividendYield]=useState(1.5);
  const [expenseRatio,setExpenseRatio]=useState(0.05);
  const [account,setAccount]=useState<AccountType>("Roth IRA / Roth 401(k)");
  const [filing,setFiling]=useState<Filing>("Single");
  const [fedTax,setFedTax]=useState(22);
  const [stateTax,setStateTax]=useState(5);
  const [capGainsTax,setCapGainsTax]=useState(15);
  const [employerMatch,setEmployerMatch]=useState(0);
  const [employerCap,setEmployerCap]=useState(0);
  const [withdrawMode,setWithdrawMode]=useState<WithdrawMode>("Monthly for N years");
  const [withdrawAmt,setWithdrawAmt]=useState(2000);
  const [withdrawYears,setWithdrawYears]=useState(25);
  const [withdrawStartAge,setWithdrawStartAge]=useState(65);
  const [withdrawTaxDeducted,setWithdrawTaxDeducted]=useState(true);
  const [repayAmt,setRepayAmt]=useState(0);
  const [repayAge,setRepayAge]=useState(60);
  const [showYearly,setShowYearly]=useState(true);
  const contribPerYear = contribFreq==="Monthly"? contrib*12 : contribFreq==="Biweekly"? contrib*26 : contrib;
  const effectiveReturn = annualReturn - expenseRatio;
  const realReturn = annualReturn - expenseRatio - inflation;
  const calc = useMemo(()=>{
    //const r = (effectiveReturn/100)/12;
    let bal=starting; let totalContrib=starting; let totalMatch=0; let totalGrowth=0;
    const rows:any[]=[]; let penaltyPaid=0; let taxPaidWithdraw=0;
    let withdrawTaxRate = account==="Taxable Brokerage" ? capGainsTax/100 : account==="Roth IRA / Roth 401(k)" ? 0 : (fedTax+stateTax)/100;
    for(let age=currentAge; age<=lifeAge; age++){
      const yearIdx = age-currentAge;
      let annualContrib = contribPerYear * Math.pow(1+contribGrowth/100, yearIdx);
      let match = 0;
      if(age<retireAge && employerCap>0){ match = Math.min(annualContrib*employerMatch/100, employerCap); }
      else if(age<retireAge && employerMatch>0 && employerCap===0){ match = annualContrib*employerMatch/100; }
      let contribThisYear = age<retireAge ? annualContrib+match : 0;
      let repayThisYear = age===repayAge ? repayAmt : 0;
      let withdrawGross=0; let withdrawNet=0; let taxThis=0; let penaltyThis=0;
      if(withdrawMode!=="None" && age>=withdrawStartAge){
        if(withdrawMode==="One-time" && age===withdrawStartAge) withdrawGross=withdrawAmt;
        else if(withdrawMode==="Monthly for N years" && age<withdrawStartAge+withdrawYears) withdrawGross=withdrawAmt*12;
        else if(withdrawMode==="Yearly for N years" && age<withdrawStartAge+withdrawYears) withdrawGross=withdrawAmt;
        else if(withdrawMode==="4% Rule" && age>=withdrawStartAge) withdrawGross=bal*0.04;
        if(account==="Taxable Brokerage"){ taxThis = withdrawGross*0.7*(capGainsTax/100); }
        else if(account==="Roth IRA / Roth 401(k)"){ taxThis = age>=59.5 ? 0 : withdrawGross*withdrawTaxRate; }
        else { taxThis = withdrawGross*withdrawTaxRate; }
        if(age<59.5 && (account.includes("Traditional")||account.includes("SEP")) && !account.includes("Roth")){ penaltyThis = withdrawGross*0.10; }
        if(account==="HSA" && age<65) penaltyThis = withdrawGross*0.20;
        withdrawNet = withdrawGross - taxThis - penaltyThis;
        taxPaidWithdraw+=taxThis; penaltyPaid+=penaltyThis;
      }
      let b=bal;
      for(let m=0;m<12;m++){
        b = (b + contribThisYear/12) * (1 + (effectiveReturn/100)/12);
        if(withdrawGross>0) b -= withdrawGross/12;
        if(m===0 && repayThisYear>0) b+=repayThisYear;
      }
      let growth = b - bal - contribThisYear - repayThisYear + withdrawGross;
      totalContrib+=contribThisYear; totalMatch+=match; totalGrowth+=growth;
      bal=b;
      let balReal = bal / Math.pow(1+inflation/100, yearIdx+1);
      rows.push({age, contrib:Math.round(contribThisYear), match:Math.round(match), withdrawGross:Math.round(withdrawGross), withdrawNet:Math.round(withdrawNet), tax:Math.round(taxThis), penalty:Math.round(penaltyThis), repay:repayThisYear, balance:Math.round(Math.max(0,bal)), realBalance:Math.round(Math.max(0,balReal))});
    }
    const atRetire = rows.find(r=>r.age===retireAge) || rows[0];
    const atWithdrawStart = rows.find(r=>r.age===withdrawStartAge);
    const finalRow = rows[rows.length-1];
    const depletion = rows.find(r=>r.balance<=0 && r.age>=withdrawStartAge);
    const balAtStart = atWithdrawStart? atWithdrawStart.balance : 0;
    const safeGrossMonthly = balAtStart*0.04/12;
    const taxRateForAllowed = account==="Roth IRA / Roth 401(k)"?0: account==="Taxable Brokerage"? capGainsTax/100*0.7 : (fedTax+stateTax)/100;
    const penaltyRate = withdrawStartAge<59.5 && !account.includes("Roth") && !account.includes("Taxable") ? 0.10 : 0;
    const allowedNetMonthly = safeGrossMonthly*(1-taxRateForAllowed-penaltyRate);
    const amountToRepayToRestore = withdrawAmt*(1+penaltyRate+taxRateForAllowed);
    return {rows, atRetire, finalRow, depletion, totalContrib, totalMatch, totalGrowth, penaltyPaid, taxPaidWithdraw, allowedNetMonthly, safeGrossMonthly, amountToRepayToRestore, balAtStart};
  },[currentAge,retireAge,lifeAge,starting,contribPerYear,contribGrowth,effectiveReturn,realReturn,inflation,account,fedTax,stateTax,capGainsTax,employerMatch,employerCap,withdrawMode,withdrawAmt,withdrawYears,withdrawStartAge,repayAmt,repayAge]);
  const Field=({label,children}:{label:string,children:any})=>(<label className="field"><span>{label}</span>{children}</label>);
  return <div className="wrap">
    <header><h1>Stocks Investment Calculator — All Ages &amp; All Conditions</h1><p>Taxable • Traditional • Roth • SEP/SIMPLE • HSA • 529 | All ages 0–100 | Contributions, employer match, inflation, dividends, fees, withdrawals, tax withheld, 10% / 20% early penalty, repayment recalculation.</p></header>
      <p> Developed by: Long Nguyen </p>
      <div className="grid">
      <section className="card">
        <h2>1. You &amp; Timeline</h2>
        <div className="cols">
          <Field label={`Current Age: ${currentAge}`}><input type="range" min="0" max="100" value={currentAge} onChange={e=>setCurrentAge(+e.target.value)}/></Field>
          <Field label={`Retirement Age: ${retireAge}`}><input type="range" min="0" max="100" value={retireAge} onChange={e=>setRetireAge(+e.target.value)}/></Field>
          <Field label={`Plan To Age: ${lifeAge}`}><input type="range" min="0" max="110" value={lifeAge} onChange={e=>setLifeAge(+e.target.value)}/></Field>
          <Field label="Filing Status"><select value={filing} onChange={e=>setFiling(e.target.value as Filing)}><option>Single</option><option>Married Filing Jointly</option><option>Head of Household</option></select></Field>
        </div>
        <h2>2. Starting &amp; Contributions</h2>
        <div className="cols">
          <Field label="Starting Amount ($)"><input type="number" value={starting} onChange={e=>setStarting(+e.target.value)}/></Field>
          <Field label="Contribution Amount"><input type="number" value={contrib} onChange={e=>setContrib(+e.target.value)}/></Field>
          <Field label="Contribution Frequency"><select value={contribFreq} onChange={e=>setContribFreq(e.target.value as ContribFreq)}><option>Monthly</option><option>Biweekly</option><option>Yearly</option></select></Field>
          <Field label={`Contribution Growth % / yr: ${contribGrowth}%`}><input type="range" min="0" max="10" step="0.5" value={contribGrowth} onChange={e=>setContribGrowth(+e.target.value)}/></Field>
          <Field label="Employer Match %"><input type="number" value={employerMatch} onChange={e=>setEmployerMatch(+e.target.value)}/></Field>
          <Field label="Employer Match Cap $ / yr (0 = no cap)"><input type="number" value={employerCap} onChange={e=>setEmployerCap(+e.target.value)}/></Field>
        </div>
        <h2>3. Growth Assumptions</h2>
        <div className="cols">
          <Field label={`Annual Return %: ${annualReturn}%`}><input type="range" min="-5" max="20" step="0.1" value={annualReturn} onChange={e=>setAnnualReturn(+e.target.value)}/></Field>
          <Field label="Return Type"><select value={returnType} onChange={e=>setReturnType(e.target.value)}><option>Nominal</option><option>Real (after inflation)</option></select></Field>
          <Field label={`Inflation %: ${inflation}%`}><input type="range" min="0" max="10" step="0.1" value={inflation} onChange={e=>setInflation(+e.target.value)}/></Field>
          <Field label={`Dividend Yield %: ${dividendYield}%`}><input type="number" value={dividendYield} onChange={e=>setDividendYield(+e.target.value)}/></Field>
          <Field label={`Expense Ratio / Fees %: ${expenseRatio}%`}><input type="number" step="0.01" value={expenseRatio} onChange={e=>setExpenseRatio(+e.target.value)}/></Field>
          <Field label="Account Type"><select value={account} onChange={e=>setAccount(e.target.value as AccountType)}><option>Taxable Brokerage</option><option>Traditional IRA / 401(k)</option><option>Roth IRA / Roth 401(k)</option><option>SEP / SIMPLE</option><option>HSA</option><option>529 / Custodial / Other</option></select></Field>
        </div>
        <h2>4. Taxes</h2>
        <div className="cols">
          <Field label={`Federal Income Tax %: ${fedTax}%`}><input type="range" min="0" max="37" value={fedTax} onChange={e=>setFedTax(+e.target.value)}/></Field>
          <Field label={`State Tax %: ${stateTax}%`}><input type="range" min="0" max="15" value={stateTax} onChange={e=>setStateTax(+e.target.value)}/></Field>
          <Field label={`Capital Gains Tax %: ${capGainsTax}%`}><input type="range" min="0" max="30" value={capGainsTax} onChange={e=>setCapGainsTax(+e.target.value)}/></Field>
        </div>
        <p className="note">Tax logic: Traditional/SEP = taxed as income on withdrawal. Roth = $0 tax if 59.5+ &amp; 5-year rule. Taxable = ~70% of withdrawal treated as gain x capital gains rate. HSA = tax-free for medical, 20% penalty before 65 if non-medical.</p>
        <h2>5. Withdrawal &amp; Repayment</h2>
        <div className="cols">
          <Field label="Withdrawal Mode"><select value={withdrawMode} onChange={e=>setWithdrawMode(e.target.value as WithdrawMode)}><option>None</option><option>One-time</option><option>Monthly for N years</option><option>Yearly for N years</option><option>4% Rule</option></select></Field>
          <Field label="Withdrawal Amount $"><input type="number" value={withdrawAmt} onChange={e=>setWithdrawAmt(+e.target.value)}/></Field>
          <Field label="Withdrawal Years"><input type="number" value={withdrawYears} onChange={e=>setWithdrawYears(+e.target.value)}/></Field>
          <Field label="Withdrawal Start Age"><input type="number" value={withdrawStartAge} onChange={e=>setWithdrawStartAge(+e.target.value)}/></Field>
          <Field label="Tax Deducted / Withheld?"><select value={withdrawTaxDeducted?"Yes":"No"} onChange={e=>setWithdrawTaxDeducted(e.target.value==="Yes")}><option>Yes</option><option>No</option></select></Field>
          <Field label="Repayment Amount $"><input type="number" value={repayAmt} onChange={e=>setRepayAmt(+e.target.value)}/></Field>
          <Field label="Repayment Age"><input type="number" value={repayAge} onChange={e=>setRepayAge(+e.target.value)}/></Field>
        </div>
        <p className="note">Penalty: 10% before 59.5 for Traditional/SEP/SIMPLE. 20% for HSA non-medical before 65. Roth: penalty only on earnings if early. Taxable: no penalty.</p>
      </section>
      <section className="card results">
        <h2>Results</h2>
        <div className="kpis">
          <div><small>Balance at Retirement ({retireAge})</small><b>{fmt(calc.atRetire.balance)}</b><span>Today dollars: {fmt(calc.atRetire.realBalance)}</span></div>
          <div><small>Balance at Withdrawal Start ({withdrawStartAge})</small><b>{fmt(calc.balAtStart)}</b></div>
          <div><small>Balance at Age {lifeAge}</small><b>{fmt(calc.finalRow.balance)}</b><span>Real: {fmt(calc.finalRow.realBalance)}</span></div>
          <div><small>Total Contributions + Match</small><b>{fmt(calc.totalContrib+calc.totalMatch)}</b><span>Match: {fmt(calc.totalMatch)}</span></div>
          <div><small>Total Growth</small><b>{fmt(calc.totalGrowth)}</b></div>
          <div><small>Total Tax on Withdrawals</small><b>{fmt(calc.taxPaidWithdraw)}</b></div>
          <div><small>Total Early Penalty Paid</small><b>{fmt(calc.penaltyPaid)}</b></div>
          <div><small>Money Runs Out?</small><b>{calc.depletion? `Yes — Age ${calc.depletion.age}` : "No — Lasts to "+lifeAge}</b></div>
        </div>
        <div className="callout"><h3>Allowed Withdrawal Amount (Safe)</h3><p>4% rule at age {withdrawStartAge}: Gross <b>{fmt(calc.safeGrossMonthly)}/mo</b> • Net after tax{withdrawStartAge<59.5?" + penalty":""}: <b>{fmt(calc.allowedNetMonthly)}/mo</b></p></div>
        <div className="callout"><h3>Repayment Recalculation</h3><p>If you withdraw <b>{fmt(withdrawAmt)}</b> early at age {withdrawStartAge}, to fully restore before another withdrawal you must repay: <b>{fmt(calc.amountToRepayToRestore)}</b> = Withdrawal + Tax + Penalty.</p><p>You entered repayment: <b>{fmt(repayAmt)}</b> at age {repayAge}. Remaining to repay: <b>{fmt(Math.max(0, calc.amountToRepayToRestore - repayAmt))}</b>. After repayment, balance is recalculated in the table (repayment added at age {repayAge}).</p><p className="small">Formula: Repay = Gross Withdrawal x (1 + Tax Rate + Penalty Rate). Lost growth is recovered by future compounding after repayment.</p></div>
        <div className="callout"><h3>Equations</h3><p className="small">Monthly: Balance(t+1) = (Balance(t) + Contribution(month)) x (1 + (Return - Fees)/12) - Withdrawal(month) + Repayment<br/>Real Balance = Nominal / (1+Inflation)^years<br/>Net Withdrawal = Gross - Tax - Penalty | Penalty = Gross x 10% if age &lt; 59.5 (20% HSA &lt; 65) | Tax (Traditional) = Gross x (Fed+State), Roth 59.5+ = 0, Taxable = Gross x 70% x Cap Gains</p></div>
        <label><input type="checkbox" checked={showYearly} onChange={e=>setShowYearly(e.target.checked)}/> Show yearly breakdown</label>
        {showYearly && <div className="tablewrap"><table><thead><tr><th>Age</th><th>Contrib</th><th>Match</th><th>Withdraw Gross</th><th>Net</th><th>Tax</th><th>Penalty</th><th>Repay</th><th>Balance</th><th>Real $</th></tr></thead><tbody>{calc.rows.map(r=><tr key={r.age}><td>{r.age}</td><td>{fmt(r.contrib)}</td><td>{fmt(r.match)}</td><td>{fmt(r.withdrawGross)}</td><td>{fmt(r.withdrawNet)}</td><td>{fmt(r.tax)}</td><td>{fmt(r.penalty)}</td><td>{fmt(r.repay)}</td><td>{fmt(r.balance)}</td><td>{fmt(r.realBalance)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
    <footer>For education only — not tax advice. Check IRS rules for your account, 5-year Roth rule, RMDs at 73-75, and contribution limits for your age/income.</footer>
  </div>
}
